"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ResourceSessionsDataTable } from "./ResourceSessionsDataTable";
import { Button } from "@app/components/ui/button";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import { toast } from "@app/hooks/useToast";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";
import { Badge } from "@app/components/ui/badge";

export type ResourceSessionRow = {
    sessionId: string;
    resourceId: number;
    resourceName: string | null;
    expiresAt: number;
    sessionLength: number;
    doNotExtend: boolean;
    isRequestToken: boolean | null;
    userSessionId: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    passwordId: number | null;
    pincodeId: number | null;
    whitelistId: number | null;
    accessTokenId: string | null;
    isExpired: boolean;
    authMethod: string;
};

type Props = {
    sessions: ResourceSessionRow[];
    onSessionsChange: (sessions: ResourceSessionRow[]) => void;
};

export default function ResourceSessionsTable({ sessions, onSessionsChange }: Props) {
    const t = useTranslations();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selected, setSelected] = useState<ResourceSessionRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const api = createApiClient(useEnvContext());

    const deleteSession = async (sessionId: string) => {
        setIsDeleting(true);
        try {
            await api.delete(`/admin/resource-sessions/${sessionId}`);
            
            const newSessions = sessions.filter((session) => session.sessionId !== sessionId);
            onSessionsChange(newSessions);
            
            toast({
                title: t('resourceSessionDeleteSuccess'),
                description: t('resourceSessionDeleteSuccessDescription')
            });
        } catch (error) {
            console.error('Error deleting resource session:', error);
            toast({
                variant: "destructive",
                title: t('resourceSessionDeleteError'),
                description: formatAxiosError(error, t('resourceSessionDeleteError'))
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setSelected(null);
        }
    };

    const formatExpiresAt = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    const getAuthMethodBadge = (method: string) => {
        const variants = {
            password: "default",
            pincode: "secondary",
            whitelist: "outline",
            access_token: "destructive",
            unknown: "default"
        } as const;

        return (
            <Badge variant={variants[method as keyof typeof variants] || "default"}>
                {t(`authMethod.${method}` as any)}
            </Badge>
        );
    };

    const columns: ColumnDef<ResourceSessionRow>[] = [
        {
            accessorKey: "sessionId",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('sessionId')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const sessionId = row.original.sessionId;
                return (
                    <div className="font-mono text-sm truncate max-w-[200px]" title={sessionId}>
                        {sessionId}
                    </div>
                );
            }
        },
        {
            accessorKey: "resourceName",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('resource')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                return row.original.resourceName || t('unknown');
            }
        },
        {
            accessorKey: "userName",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('user')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const { userName, userEmail } = row.original;
                return (
                    <div>
                        <div className="font-medium">{userName || t('unknown')}</div>
                        {userEmail && (
                            <div className="text-sm text-muted-foreground">{userEmail}</div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "authMethod",
            header: t('authMethod.label'),
            cell: ({ row }) => {
                return getAuthMethodBadge(row.original.authMethod);
            }
        },
        {
            accessorKey: "expiresAt",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('expiresAt')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const { expiresAt, isExpired } = row.original;
                return (
                    <div className={isExpired ? "text-red-500" : ""}>
                        {formatExpiresAt(expiresAt)}
                        {isExpired && (
                            <Badge variant="destructive" className="ml-2">
                                {t('expired')}
                            </Badge>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "doNotExtend",
            header: t('doNotExtend'),
            cell: ({ row }) => {
                return row.original.doNotExtend ? (
                    <Badge variant="outline">{t('yes')}</Badge>
                ) : (
                    <Badge variant="secondary">{t('no')}</Badge>
                );
            }
        },
        {
            id: "actions",
            header: t('actions'),
            cell: ({ row }) => {
                const session = row.original;
                return (
                    <div className="flex items-center justify-end">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                setSelected(session);
                                setIsDeleteModalOpen(true);
                            }}
                            disabled={isDeleting}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('delete')}
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <>
            {selected && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        if (!val) setSelected(null);
                    }}
                    dialog={
                        <div className="space-y-4">
                            <p>
                                {t('resourceSessionDeleteConfirm', {
                                    resource: selected.resourceName || t('unknown'),
                                    user: selected.userName || selected.userEmail || t('unknown')
                                })}
                            </p>
                            <div className="bg-yellow-50 p-3 rounded-md">
                                <p className="text-sm text-yellow-800">
                                    <strong>{t('warning')}:</strong> {t('resourceSessionDeleteWarning')}
                                </p>
                            </div>
                        </div>
                    }
                    buttonText={t('deleteSession')}
                    onConfirm={() => deleteSession(selected.sessionId)}
                    string={selected.sessionId}
                    title={t('resourceSessionDelete')}
                />
            )}

            <ResourceSessionsDataTable columns={columns} data={sessions} />
        </>
    );
}