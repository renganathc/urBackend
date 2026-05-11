const mongoose = require('mongoose');
const { Developer, Project, Log, PlatformEvent, DeveloperActivity } = require('@urbackend/common');

/**
 * Guard: only callable by the platform admin.
 * Checked upstream via the isAdmin flag on the JWT payload,
 * but we double-check here for defence in depth.
 */
function requireAdmin(req, res) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ success: false, data: {}, message: 'Admin access required.' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/overview
// Platform-wide snapshot: signups, verified devs, active projects, total calls.
// ---------------------------------------------------------------------------
module.exports.getOverview = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const [
      totalDevelopers,
      verifiedDevelopers,
      totalProjects,
      totalApiCalls,
      northStarProjects,
    ] = await Promise.all([
      Developer.countDocuments(),
      Developer.countDocuments({ isVerified: true }),
      Project.countDocuments(),
      Log.countDocuments(),
      Log.distinct('projectId', {
        status: { $gte: 200, $lt: 300 },
        timestamp: { $gte: sevenDaysAgo },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        totalDevelopers,
        verifiedDevelopers,
        totalProjects,
        totalApiCalls,
        activeProjectsLast7d: northStarProjects.length,
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/activation-funnel
// Platform-wide funnel: count of devs who completed each activation step.
// ---------------------------------------------------------------------------
module.exports.getActivationFunnel = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const FUNNEL_STEPS = [
      'signup_completed',
      'email_verified',
      'project_created',
      'collection_created',
      'first_api_success',
    ];

    const counts = await PlatformEvent.aggregate([
      { $match: { event: { $in: FUNNEL_STEPS } } },
      {
        $group: {
          _id: '$event',
          uniqueDevs: { $addToSet: '$developerId' },
        },
      },
      {
        $project: {
          event: '$_id',
          count: { $size: '$uniqueDevs' },
          _id: 0,
        },
      },
    ]);

    const countMap = {};
    for (const row of counts) {
      countMap[row.event] = row.count;
    }

    const steps = FUNNEL_STEPS.map((step, i) => ({
      step,
      order: i + 1,
      uniqueDevs: countMap[step] || 0,
    }));

    return res.json({ success: true, data: { steps }, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/cohorts?month=2026-05
// D1/D7/D30 retention for developers who signed up in a given month.
// ---------------------------------------------------------------------------
module.exports.getCohorts = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { month } = req.query; // e.g. "2026-05"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        data: {},
        message: 'Provide month as YYYY-MM (e.g. 2026-05)',
      });
    }

    const [year, mo] = month.split('-').map(Number);
    const cohortStart = new Date(Date.UTC(year, mo - 1, 1));
    const cohortEnd = new Date(Date.UTC(year, mo, 1));

    // Developers who signed up in this cohort month
    const signups = await PlatformEvent.find({
      event: 'signup_completed',
      timestamp: { $gte: cohortStart, $lt: cohortEnd },
    })
      .select('developerId timestamp')
      .lean();

    const cohortSize = signups.length;
    if (cohortSize === 0) {
      return res.json({
        success: true,
        data: { month, cohortSize: 0, d1: 0, d7: 0, d30: 0 },
        message: '',
      });
    }

    // For each developer, check if active on D+1, D+7, D+30
    const checkDayRetention = async (daysAfter) => {
      let retained = 0;
      await Promise.all(
        signups.map(async (s) => {
          const base = new Date(s.timestamp);
          base.setUTCHours(0, 0, 0, 0);
          const target = new Date(base);
          target.setUTCDate(target.getUTCDate() + daysAfter);
          const next = new Date(target);
          next.setUTCDate(next.getUTCDate() + 1);

          const exists = await DeveloperActivity.findOne({
            developerId: s.developerId,
            date: { $gte: target, $lt: next },
          }).lean();
          if (exists) retained++;
        }),
      );
      return retained;
    };

    const [d1, d7, d30] = await Promise.all([
      checkDayRetention(1),
      checkDayRetention(7),
      checkDayRetention(30),
    ]);

    return res.json({
      success: true,
      data: {
        month,
        cohortSize,
        d1,
        d7,
        d30,
        d1Pct: Math.round((d1 / cohortSize) * 100),
        d7Pct: Math.round((d7 / cohortSize) * 100),
        d30Pct: Math.round((d30 / cohortSize) * 100),
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/feature-usage
// Platform-wide feature breakdown from DeveloperActivity (last 30 days).
// ---------------------------------------------------------------------------
module.exports.getFeatureUsage = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const agg = await DeveloperActivity.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalApiCalls: { $sum: '$apiCallCount' },
          totalMailSent: { $sum: '$mailSentCount' },
          totalStorageUploads: { $sum: '$storageUploadsCount' },
          totalWebhooksFired: { $sum: '$webhookTriggeredCount' },
          activeDevelopers: { $addToSet: '$developerId' },
        },
      },
    ]);

    const result = agg[0] || {
      totalApiCalls: 0,
      totalMailSent: 0,
      totalStorageUploads: 0,
      totalWebhooksFired: 0,
      activeDevelopers: [],
    };

    return res.json({
      success: true,
      data: {
        window: '30d',
        totalApiCalls: result.totalApiCalls,
        totalMailSent: result.totalMailSent,
        totalStorageUploads: result.totalStorageUploads,
        totalWebhooksFired: result.totalWebhooksFired,
        activeDevelopers: result.activeDevelopers.length,
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/reliability
// Global error rate and latency across all projects (last 24h from ApiAnalytics).
// ---------------------------------------------------------------------------
module.exports.getReliability = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { ApiAnalytics } = require('@urbackend/common');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const agg = await ApiAnalytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ['$statusCode', 500] }, 1, 0] } },
          p50: { $percentile: { input: '$responseTimeMs', p: [0.5], method: 'approximate' } },
          p95: { $percentile: { input: '$responseTimeMs', p: [0.95], method: 'approximate' } },
          p99: { $percentile: { input: '$responseTimeMs', p: [0.99], method: 'approximate' } },
        },
      },
    ]);

    const r = agg[0] || { total: 0, errors: 0, p50: [0], p95: [0], p99: [0] };

    return res.json({
      success: true,
      data: {
        window: '24h',
        totalRequests: r.total,
        errorCount: r.errors,
        errorRate: r.total > 0 ? ((r.errors / r.total) * 100).toFixed(2) : '0.00',
        p50Ms: r.p50?.[0]?.toFixed(1) ?? null,
        p95Ms: r.p95?.[0]?.toFixed(1) ?? null,
        p99Ms: r.p99?.[0]?.toFixed(1) ?? null,
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/top-projects
// Most active projects by API calls in the last 7 days.
// ---------------------------------------------------------------------------
module.exports.getTopProjects = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const agg = await Log.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$projectId', callCount: { $sum: 1 } } },
      { $sort: { callCount: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $project: {
          _id: 0,
          projectId: '$_id',
          callCount: 1,
          projectName: { $arrayElemAt: ['$project.name', 0] },
        },
      },
    ]);

    return res.json({ success: true, data: { projects: agg }, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/metrics/churn-signals
// Projects with zero API calls in the last 14 days that had prior activity.
// ---------------------------------------------------------------------------
module.exports.getChurnSignals = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    // Projects active in 30–14d window
    const prevActive = await Log.distinct('projectId', {
      timestamp: { $gte: thirtyDaysAgo, $lt: fourteenDaysAgo },
    });

    // Projects that were active but have ZERO calls in last 14d
    const recentlyActive = await Log.distinct('projectId', {
      timestamp: { $gte: fourteenDaysAgo },
    });
    const recentSet = new Set(recentlyActive.map(String));

    const churnedIds = prevActive.filter((id) => !recentSet.has(String(id)));

    const projects = await Project.find({ _id: { $in: churnedIds } })
      .select('name owner createdAt')
      .populate('owner', 'email')
      .limit(50)
      .lean();

    return res.json({
      success: true,
      data: { churnSignals: churnedIds.length, projects },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: {}, message: err.message });
  }
};
