import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, inArray, and } from "drizzle-orm";
import logger from "@server/logger";
import { resourceSessions } from "@server/db";
import { fromZodError } from "zod-validation-error";

const deleteResourceSessionSchema = z
    .object({
        sessionId: z.string().min(1)
    })
    .strict();

const bulkDeleteResourceSessionsSchema = z
    .object({
        sessionIds: z.array(z.string().min(1)).min(1).max(100),
        resourceId: z.number().int().positive().optional()
    })
    .strict();

export async function deleteResourceSession(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteResourceSessionSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedParams.error)
                )
            );
        }

        const { sessionId } = parsedParams.data;

        // Check if session exists
        const existingSession = await db
            .select()
            .from(resourceSessions)
            .where(eq(resourceSessions.sessionId, sessionId))
            .limit(1);

        if (existingSession.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "Resource session not found"
                )
            );
        }

        // Delete the session
        await db
            .delete(resourceSessions)
            .where(eq(resourceSessions.sessionId, sessionId));

        return response(res, {
            data: { sessionId },
            success: true,
            error: false,
            message: "Resource session deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error deleting resource session:", error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

export async function bulkDeleteResourceSessions(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = bulkDeleteResourceSessionsSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedBody.error)
                )
            );
        }

        const { sessionIds, resourceId } = parsedBody.data;

        // Build delete condition
        let deleteCondition = inArray(resourceSessions.sessionId, sessionIds);
        
        if (resourceId) {
            deleteCondition = and(
                deleteCondition,
                eq(resourceSessions.resourceId, resourceId)
            ) as any;
        }

        // Delete the sessions
        const deletedSessions = await db
            .delete(resourceSessions)
            .where(deleteCondition)
            .returning({ sessionId: resourceSessions.sessionId });

        const deletedCount = deletedSessions.length;

        if (deletedCount === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "No matching resource sessions found"
                )
            );
        }

        return response(res, {
            data: { 
                deletedCount,
                deletedSessionIds: deletedSessions.map(s => s.sessionId)
            },
            success: true,
            error: false,
            message: `${deletedCount} resource session(s) deleted successfully`,
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error bulk deleting resource sessions:", error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}