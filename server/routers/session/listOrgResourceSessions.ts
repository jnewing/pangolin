import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { sql, eq, desc, asc, and, or, like, gt } from "drizzle-orm";
import logger from "@server/logger";
import { resourceSessions, resources, users, sessions } from "@server/db";
import { fromZodError } from "zod-validation-error";

const listOrgResourceSessionsSchema = z
    .object({
        limit: z
            .string()
            .optional()
            .default("100")
            .transform(Number)
            .pipe(z.number().int().positive().max(1000)),
        offset: z
            .string()
            .optional()
            .default("0")
            .transform(Number)
            .pipe(z.number().int().nonnegative()),
        search: z.string().optional(),
        resourceId: z
            .string()
            .optional()
            .transform((val) => val && val !== "" ? Number(val) : undefined)
            .refine((val) => val === undefined || (!isNaN(val) && val > 0), {
                message: "Resource ID must be a positive number"
            }),
        userId: z.string().optional(),
        sortBy: z.enum(["expiresAt", "resourceName", "userName"]).optional().default("expiresAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
        includeExpired: z
            .string()
            .optional()
            .default("false")
            .transform(val => val === "true")
    })
    .strict();

async function queryOrgResourceSessions(
    orgId: string,
    limit: number,
    offset: number,
    search?: string,
    resourceId?: number,
    userId?: string,
    sortBy: string = "expiresAt",
    sortOrder: string = "desc",
    includeExpired: boolean = false
) {
    const currentTime = Math.floor(Date.now() / 1000);
    
    let query = db
        .select({
            sessionId: resourceSessions.sessionId,
            resourceId: resourceSessions.resourceId,
            resourceName: resources.name,
            expiresAt: resourceSessions.expiresAt,
            sessionLength: resourceSessions.sessionLength,
            doNotExtend: resourceSessions.doNotExtend,
            isRequestToken: resourceSessions.isRequestToken,
            userSessionId: resourceSessions.userSessionId,
            userId: users.userId,
            userName: users.name,
            userEmail: users.email,
            passwordId: resourceSessions.passwordId,
            pincodeId: resourceSessions.pincodeId,
            whitelistId: resourceSessions.whitelistId,
            accessTokenId: resourceSessions.accessTokenId,
            isExpired: sql<boolean>`${resourceSessions.expiresAt} < ${currentTime}`,
            authMethod: sql<string>`
                CASE 
                    WHEN ${resourceSessions.passwordId} IS NOT NULL THEN 'password'
                    WHEN ${resourceSessions.pincodeId} IS NOT NULL THEN 'pincode'
                    WHEN ${resourceSessions.whitelistId} IS NOT NULL THEN 'whitelist'
                    WHEN ${resourceSessions.accessTokenId} IS NOT NULL THEN 'access_token'
                    ELSE 'unknown'
                END
            `
        })
        .from(resourceSessions)
        .leftJoin(resources, eq(resourceSessions.resourceId, resources.resourceId))
        .leftJoin(sessions, eq(resourceSessions.userSessionId, sessions.sessionId))
        .leftJoin(users, eq(sessions.userId, users.userId))
        .where(eq(resources.orgId, orgId));

    // Apply filters
    if (!includeExpired) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                gt(resourceSessions.expiresAt, currentTime)
            )
        );
    }
    
    if (resourceId) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                eq(resourceSessions.resourceId, resourceId)
            )
        );
    }
    
    if (userId) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                eq(users.userId, userId)
            )
        );
    }
    
    if (search) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                or(
                    like(resources.name, `%${search}%`),
                    like(users.name, `%${search}%`),
                    like(users.email, `%${search}%`)
                )
            )
        );
    }

    // Apply sorting
    const sortColumn = sortBy === "resourceName" ? resources.name 
                     : sortBy === "userName" ? users.name 
                     : resourceSessions.expiresAt;
    
    query = (query as any).orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn));

    return await query.limit(limit).offset(offset);
}

async function getOrgResourceSessionsCount(
    orgId: string,
    search?: string,
    resourceId?: number,
    userId?: string,
    includeExpired: boolean = false
) {
    const currentTime = Math.floor(Date.now() / 1000);
    
    let query = db
        .select({ count: sql<number>`count(*)` })
        .from(resourceSessions)
        .leftJoin(resources, eq(resourceSessions.resourceId, resources.resourceId))
        .leftJoin(sessions, eq(resourceSessions.userSessionId, sessions.sessionId))
        .leftJoin(users, eq(sessions.userId, users.userId))
        .where(eq(resources.orgId, orgId));

    if (!includeExpired) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                gt(resourceSessions.expiresAt, currentTime)
            )
        );
    }
    
    if (resourceId) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                eq(resourceSessions.resourceId, resourceId)
            )
        );
    }
    
    if (userId) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                eq(users.userId, userId)
            )
        );
    }
    
    if (search) {
        query = (query as any).where(
            and(
                eq(resources.orgId, orgId),
                or(
                    like(resources.name, `%${search}%`),
                    like(users.name, `%${search}%`),
                    like(users.email, `%${search}%`)
                )
            )
        );
    }

    const [{ count }] = await query;
    return count;
}

export type ListOrgResourceSessionsResponse = {
    sessions: NonNullable<Awaited<ReturnType<typeof queryOrgResourceSessions>>>;
    pagination: { total: number; limit: number; offset: number };
};

export async function listOrgResourceSessions(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const { orgId } = req.params;
        
        if (!orgId) {
            return next(
                createHttpError(HttpCode.BAD_REQUEST, "Organization ID is required")
            );
        }

        const parsedQuery = listOrgResourceSessionsSchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedQuery.error)
                )
            );
        }
        
        const { 
            limit, 
            offset, 
            search, 
            resourceId, 
            userId, 
            sortBy, 
            sortOrder, 
            includeExpired 
        } = parsedQuery.data;

        const sessions = await queryOrgResourceSessions(
            orgId,
            limit,
            offset,
            search,
            resourceId,
            userId,
            sortBy,
            sortOrder,
            includeExpired
        );

        const total = await getOrgResourceSessionsCount(
            orgId,
            search,
            resourceId,
            userId,
            includeExpired
        );

        return response<ListOrgResourceSessionsResponse>(res, {
            data: {
                sessions,
                pagination: {
                    total,
                    limit,
                    offset
                }
            },
            success: true,
            error: false,
            message: "Organization resource sessions retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error listing organization resource sessions:", error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}