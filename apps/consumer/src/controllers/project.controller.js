const { AppError } = require('@urbackend/common');
const { Developer } = require('@urbackend/common');

module.exports.dbExportHandler = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { _id: userId } = req.user;

        const developer = await Developer.findById(userId).select('email').lean();
        if (!developer) {
            return next(new AppError(404, "Authenticated developer not found."));
        }
        const { email } = developer;

        console.log(`[Consumer API] Received export request for project ${projectId} from user ${userId} (${email})`);

        // just acknowledging the request, for now
        return res.status(202).json({
            message: `Export request for project ${projectId} received by consumer. Processing will begin shortly.`,
        });

    } catch (err) {
        console.error(`[Consumer API] Error handling export request for project ${req.params.projectId}:`, err);
        return next(new AppError(500, err.message || "Failed to initiate database export."));
    }
};
