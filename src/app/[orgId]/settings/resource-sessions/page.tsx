"use client";

import { useState, useEffect } from "react";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { Alert, AlertDescription, AlertTitle } from "@app/components/ui/alert";
import { InfoIcon, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@app/hooks/useToast";
import { formatAxiosError } from "@app/lib/api";
import ResourceSessionsTable, { ResourceSessionRow } from "./ResourceSessionsTable";
import { Button } from "@app/components/ui/button";
import { ListOrgResourceSessionsResponse } from "@server/routers/session/listOrgResourceSessions";
import { Card, CardContent, CardHeader, CardTitle } from "@app/components/ui/card";
import { Badge } from "@app/components/ui/badge";
import { useParams } from "next/navigation";

export default function ResourceSessionsPage() {
    const t = useTranslations();
    const api = createApiClient(useEnvContext());
    const params = useParams();
    const orgId = params.orgId as string;
    
    const [sessions, setSessions] = useState<ResourceSessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        expired: 0
    });

    const fetchResourceSessions = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await api.get(`/org/${orgId}/resource-sessions`, {
                params: {
                    limit: 1000,
                    includeExpired: true
                }
            });

            const sessionData = response.data.data.sessions;
            setSessions(sessionData as ResourceSessionRow[]);

            // Calculate stats
            const total = sessionData.length;
            const expired = sessionData.filter((s: any) => s.isExpired).length;
            const active = total - expired;
            
            setStats({ total, active, expired });

        } catch (error) {
            console.error('Error fetching resource sessions:', error);
            toast({
                variant: "destructive",
                title: t('resourceSessionsLoadError'),
                description: formatAxiosError(error, t('resourceSessionsLoadError'))
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSessionsChange = (updatedSessions: ResourceSessionRow[]) => {
        setSessions(updatedSessions);
        
        // Recalculate stats
        const total = updatedSessions.length;
        const expired = updatedSessions.filter((s: any) => s.isExpired).length;
        const active = total - expired;
        
        setStats({ total, active, expired });
    };

    const bulkDeleteExpiredSessions = async () => {
        const expiredSessionIds = sessions.filter((s: any) => s.isExpired).map((s: any) => s.sessionId);
        
        if (expiredSessionIds.length === 0) {
            toast({
                title: t('noExpiredSessions'),
                description: t('noExpiredSessionsDescription')
            });
            return;
        }

        try {
            await api.post(`/org/${orgId}/resource-sessions/bulk-delete`, {
                sessionIds: expiredSessionIds
            });

            const remainingSessions = sessions.filter((s: any) => !s.isExpired);
            handleSessionsChange(remainingSessions);

            toast({
                title: t('expiredSessionsDeleted'),
                description: t('expiredSessionsDeletedDescription', { count: expiredSessionIds.length })
            });
        } catch (error) {
            console.error('Error bulk deleting expired sessions:', error);
            toast({
                variant: "destructive",
                title: t('bulkDeleteError'),
                description: formatAxiosError(error, t('bulkDeleteError'))
            });
        }
    };

    useEffect(() => {
        fetchResourceSessions();
    }, [orgId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                {t('loading')}
            </div>
        );
    }

    return (
        <>
            <SettingsSectionTitle
                title={t('resourceSessions')}
                description={t('resourceSessionsDescription')}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('totalSessions')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('activeSessions')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('expiredSessions')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
                    </CardContent>
                </Card>
            </div>

            <Alert variant="neutral" className="mb-6">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle className="font-semibold">{t('resourceSessionsAbout')}</AlertTitle>
                <AlertDescription>
                    {t('resourceSessionsAboutDescription')}
                </AlertDescription>
            </Alert>

            <div className="flex justify-between items-center mb-4">
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        onClick={() => fetchResourceSessions(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                    </Button>
                    
                    {stats.expired > 0 && (
                        <Button
                            variant="destructive"
                            onClick={bulkDeleteExpiredSessions}
                        >
                            {t('deleteExpiredSessions')} ({stats.expired})
                        </Button>
                    )}
                </div>
            </div>

            <ResourceSessionsTable 
                sessions={sessions}
                onSessionsChange={handleSessionsChange}
                orgId={orgId}
            />
        </>
    );
}