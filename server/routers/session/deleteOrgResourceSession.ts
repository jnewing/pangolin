import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, inArray, and } from "drizzle-orm";
import logger from "@server/logger";
import { resourceSessions, resources } from "@server/db";
import { fromZodError } from "zod-validation-error";

const deleteOrgResourceSessionSchema = z
    .object({
        sessionId: z.string().min(1),
        orgId: z.string().min(1)
    })
    .strict();

const bulkDeleteOrgResourceSessionsSchema = z
    .object({
        sessionIds: z.array(z.string().min(1)).min(1).max(100),
        resourceId: z.number().int().positive().optional()
    })
    .strict();

const orgIdSchema = z.object({
    orgId: z.string().min(1)
}).strict();

export async function deleteOrgResourceSession(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteOrgResourceSessionSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedParams.error)
                )
            );
        }

        const { sessionId, orgId } = parsedParams.data;

        // Check if session exists and belongs to the organization
        const existingSession = await db
            .select({
                sessionId: resourceSessions.sessionId,
                resourceId: resourceSessions.resourceId
            })
            .from(resourceSessions)
            .leftJoin(resources, eq(resourceSessions.resourceId, resources.resourceId))
            .where(
                and(
                    eq(resourceSessions.sessionId, sessionId),
                    eq(resources.orgId, orgId)
                )
            )
            .limit(1);

        if (existingSession.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "Resource session not found or does not belong to this organization"
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
        logger.error("Error deleting organization resource session:", error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

export async function bulkDeleteOrgResourceSessions(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = orgIdSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedParams.error)
                )
            );
        }

        const { orgId } = parsedParams.data;

        const parsedBody = bulkDeleteOrgResourceSessionsSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedBody.error)
                )
            );
        }

        const { sessionIds, resourceId } = parsedBody.data;

        // First, get all session IDs that belong to this organization
        let orgSessionsQuery = db
            .select({ sessionId: resourceSessions.sessionId })
            .from(resourceSessions)
            .leftJoin(resources, eq(resourceSessions.resourceId, resources.resourceId))
            .where(
                and(
                    eq(resources.orgId, orgId),
                    inArray(resourceSessions.sessionId, sessionIds)
                )
            );

        // Add resource filter if specified
        if (resourceId) {
            orgSessionsQuery = orgSessionsQuery.where(
                and(
                    eq(resources.orgId, orgId),
                    eq(resourceSessions.resourceId, resourceId),
                    inArray(resourceSessions.sessionId, sessionIds)
                )
            ) as any;
        }

        const orgSessions = await orgSessionsQuery;
        const orgSessionIds = orgSessions.map(s => s.sessionId);

        if (orgSessionIds.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "No matching resource sessions found for this organization"
                )
            );
        }

        // Delete only the sessions that belong to this organization
        const deletedSessions = await db
            .delete(resourceSessions)
            .where(inArray(resourceSessions.sessionId, orgSessionIds))
            .returning({ sessionId: resourceSessions.sessionId });

        const deletedCount = deletedSessions.length;

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
        logger.error("Error bulk deleting organization resource sessions:", error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}