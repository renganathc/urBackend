const { AppError } = require('@urbackend/common');
const { Developer } = require('@urbackend/common');
const { Project } = require('@urbackend/common');
const { exportQueue } = require('@urbackend/common');

module.exports.dbExportHandler = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { _id: userId } = req.user;

        
        const project = await Project.findById(projectId).select('owner').lean();
        if (!project) {
            return next(new AppError(404, "Project not found."));
        }
        if (project.owner.toString() !== userId.toString()) {
            return next(new AppError(403, "Access denied. You are not the owner of this project."));
        }

        
        const developer = await Developer.findById(userId).select('email plan').lean();
        if (!developer) {
            return next(new AppError(404, "Authenticated developer not found."));
        }
        const { email, plan = 'free' } = developer;

        console.log(`[Dashboard API] Received export request for project ${projectId} from user ${userId} (${email})`);

        await exportQueue.add('export-database', { projectId, userId, email });

        return res.status(202).json({
            message: `Database export request received. You will receive an email with a download link shortly.`,
        });

    } catch (err) {
        console.error(`[Dashboard API] Error handling export request for project ${req.params.projectId}:`, err);
        return next(new AppError(500, err.message || "Failed to initiate database export."));
    }
};
