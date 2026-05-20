const { Queue, Worker } = require('bullmq');
const connection = require('../config/redis');
const Project = require('../models/Project');
const { getConnection } = require('../utils/connection.manager');
const { getCompiledModel } = require('../utils/injectModel');

const QUEUE_NAME = 'trash-cleanup-queue';

const trashCleanupQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Enqueue a specific collection for soft-delete cleanup.
 * Uses jobId for deduplication so multiple deletes before the cron runs
 * only result in a single cleanup job.
 */
async function enqueueCollectionCleanup(projectId, collectionName) {
  try {
    await trashCleanupQueue.add(
      'cleanup-collection',
      { projectId, collectionName },
      {
        jobId: `${projectId}:${collectionName}`, // Deduplication
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    );
  } catch (err) {
    console.error(`[TrashCleanup] Failed to enqueue collection cleanup for ${projectId}:${collectionName}`, err.message);
  }
}

/**
 * Schedule the weekly trash cleanup job (fallback scan).
 * Runs at Wednesday 21:30 UTC = Thursday 03:00 IST.
 */
async function scheduleTrashCleanup() {
  const existing = await trashCleanupQueue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === 'weekly-trash-cleanup' || job.name === 'daily-trash-cleanup') {
      await trashCleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  await trashCleanupQueue.add(
    'weekly-trash-cleanup',
    {},
    {
      repeat: { 
        pattern: '30 21 * * 3', // Wednesday 21:30 UTC
        tz: 'UTC'
      },
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
  console.log('[TrashCleanup] Weekly fallback cron scheduled (Thu 03:00 IST)');
}

async function processCollectionCleanup(project, collectionConfig, projectConn) {
  const BATCH_SIZE = 500;

  const Model = getCompiledModel(
    projectConn,
    collectionConfig,
    project._id,
    project.resources.db.isExternal
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deleteFilter = {
    isDeleted: true,
    deletedAt: { $lt: thirtyDaysAgo },
  };

  let totalDocsDeleted = 0;
  let totalSpaceReclaimed = 0;

  while (true) {
    // Fetch a batch of IDs to delete and accurately measure their storage size using $bsonSize
    const docsBatch = await Model.aggregate([
      { $match: deleteFilter },
      { $limit: BATCH_SIZE },
      { $project: { _id: 1, size: { $bsonSize: "$$ROOT" } } }
    ]);

    if (docsBatch.length === 0) {
      break;
    }

    const idsToDelete = docsBatch.map(d => d._id);
    const batchSizeBytes = docsBatch.reduce((sum, d) => sum + (d.size || 1024), 0);

    const result = await Model.deleteMany({
      _id: { $in: idsToDelete },
      ...deleteFilter,
    });

    if (result && result.deletedCount > 0) {
      totalDocsDeleted += result.deletedCount;
      totalSpaceReclaimed += batchSizeBytes;
      console.log(`[TrashCleanup] Deleted batch of ${result.deletedCount} documents (${batchSizeBytes} bytes) from ${project.name}.${collectionConfig.name}`);
    }
    
    // Break if we processed fewer than BATCH_SIZE (no more to fetch)
    // or if nothing was deleted (failsafe to prevent infinite loop)
    if (docsBatch.length < BATCH_SIZE || result.deletedCount === 0) {
      break;
    }
  }

  if (totalDocsDeleted > 0 && !project.resources.db.isExternal) {
    // Single atomic pipeline update using $max to ensure it doesn't go below 0
    await Project.updateOne(
      { _id: project._id },
      [
        { 
          $set: { 
            databaseUsed: { 
              $max: [0, { $subtract: [{ $ifNull: ['$databaseUsed', 0] }, totalSpaceReclaimed] }] 
            } 
          } 
        }
      ]
    );
  }
}

/**
 * Run the full fallback scan logic.
 */
async function runFullTrashCleanup() {
  console.log('[TrashCleanup] Starting weekly fallback cleanup...');
  
  const projects = await Project.find({}).lean();

  for (const project of projects) {
    try {
      const projectConn = await getConnection(project._id);
      for (const collectionConfig of project.collections) {
        await processCollectionCleanup(project, collectionConfig, projectConn);
      }
    } catch (err) {
      console.error(`[TrashCleanup] Failed to clean trash for project ${project._id}:`, err.message);
    }
  }

  console.log('[TrashCleanup] Weekly fallback cleanup finished.');
}

/**
 * Initialize the BullMQ worker for trash cleanup.
 */
function initTrashCleanupWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'cleanup-collection') {
        const { projectId, collectionName } = job.data;
        console.log(`[TrashCleanup] Processing targeted cleanup for ${projectId}:${collectionName}`);
        
        const project = await Project.findById(projectId).lean();
        if (!project) return;
        
        const collectionConfig = project.collections.find(c => c.name === collectionName);
        if (!collectionConfig) return;

        const projectConn = await getConnection(project._id);
        await processCollectionCleanup(project, collectionConfig, projectConn);

      } else if (job.name === 'weekly-trash-cleanup') {
        await runFullTrashCleanup();
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on('completed', (job) => console.log(`[TrashCleanup] Job ${job.name} completed successfully`));
  worker.on('failed', (job, err) =>
    console.error(`[TrashCleanup] Job ${job.name} failed:`, err.message)
  );

  console.log('[TrashCleanup] Worker initialized');
  return worker;
}

module.exports = {
  trashCleanupQueue,
  enqueueCollectionCleanup,
  scheduleTrashCleanup,
  initTrashCleanupWorker,
  runFullTrashCleanup
};
