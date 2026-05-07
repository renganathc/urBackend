const { Queue, Worker } = require('bullmq');
const connection = require('../config/redis');
const Project = require('../models/Project');
const { decrypt } = require('../utils/encryption');
const { Resend } = require('resend');

// Create the email queue for public API
const publicEmailQueue = new Queue('public-email-queue', { connection });

let worker = null;

const initPublicEmailWorker = () => {
    if (worker) return worker;

    // Initialize Worker with Rate Limiting (10 per second to respect Resend limits)
    worker = new Worker('public-email-queue', async (job) => {
        const { projectId, payload, usingByok, consumedQuotaKey } = job.data;
        
        try {
        
        let clientKey = process.env.RESEND_API_KEY_2 || process.env.RESEND_API_KEY;
        let fromAddress = process.env.EMAIL_FROM || "urBackend <urbackend@apps.bitbros.in>";

        try {
            if (projectId && usingByok) {
                const project = await Project.findById(projectId).select('+resendApiKey.encrypted +resendApiKey.iv +resendApiKey.tag resendFromEmail').lean();
                if (project && project.resendApiKey) {
                    const decrypted = decrypt(project.resendApiKey);
                    if (typeof decrypted === 'string' && decrypted.trim().length > 0) {
                        clientKey = decrypted.trim();
                        fromAddress = project.resendFromEmail && project.resendFromEmail.trim() 
                            ? project.resendFromEmail.trim() 
                            : "onboarding@resend.dev";
                    }
                }
            }
        } catch (err) {
            console.error(`[Queue] Failed to load BYOK config for project ${projectId}:`, err);
            // Fallback to global key
        }

        if (!clientKey) {
            throw new Error("Resend API key is not configured.");
        }

        const resend = new Resend(clientKey);

        const finalPayload = {
            ...payload,
            from: fromAddress
        };

        console.log(`[Queue] Processing public email to: ${finalPayload.to}`);
        
        const { data, error } = await resend.emails.send(finalPayload);
        
        if (error) {
            console.error(`[Queue] Failed to send public email to ${finalPayload.to}:`, error);
            throw new Error(error.message || "Failed to send email");
        }
        
        return { data };
        } catch (err) {
            throw err;
        }
    }, {
        connection,
        limiter: {
            max: 10,
            duration: 1000, // 10 per second
        }
    });

    worker.on('completed', (job) => {
        console.log(`[Queue] Job ${job.id} (public email) completed successfully`);
    });

    worker.on('failed', async (job, err) => {
        console.error(`[Queue] Job ${job?.id} (public email) failed:`, err);
        if (job && job.data && job.data.consumedQuotaKey) {
            const maxAttempts = job.opts?.attempts || 1;
            if (job.attemptsMade >= maxAttempts) {
                await connection.decr(job.data.consumedQuotaKey).catch(() => {});
            }
        }
    });

    return worker;
};

module.exports = { publicEmailQueue, initPublicEmailWorker };
