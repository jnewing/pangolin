import { SidebarNavItem } from "@app/components/SidebarNav";
import {
    Home,
    Settings,
    Users,
    Link as LinkIcon,
    Waypoints,
    Combine,
    Fingerprint,
    KeyRound,
    TicketCheck,
    Clock
} from "lucide-react";

export const orgLangingNavItems: SidebarNavItem[] = [
    {
        title: "sidebarOverview",
        href: "/{orgId}",
        icon: <Home className="h-4 w-4" />
    }
];

export const rootNavItems: SidebarNavItem[] = [
    {
        title: "sidebarHome",
        href: "/",
        icon: <Home className="h-4 w-4" />
    }
];

export const orgNavItems: SidebarNavItem[] = [
    {
        title: "sidebarSites",
        href: "/{orgId}/settings/sites",
        icon: <Combine className="h-4 w-4" />
    },
    {
        title: "sidebarResources",
        href: "/{orgId}/settings/resources",
        icon: <Waypoints className="h-4 w-4" />
    },
    {
        title: "sidebarResourceSessions",
        href: "/{orgId}/settings/resource-sessions",
        icon: <Clock className="h-4 w-4" />
    },
    {
        title: "sidebarAccessControl",
        href: "/{orgId}/settings/access",
        icon: <Users className="h-4 w-4" />,
        autoExpand: true,
        children: [
            {
                title: "sidebarUsers",
                href: "/{orgId}/settings/access/users",
                children: [
                    {
                        title: "sidebarInvitations",
                        href: "/{orgId}/settings/access/invitations"
                    }
                ]
            },
            {
                title: "sidebarRoles",
                href: "/{orgId}/settings/access/roles"
            }
        ]
    },
    {
        title: "sidebarShareableLinks",
        href: "/{orgId}/settings/share-links",
        icon: <LinkIcon className="h-4 w-4" />
    },
    {
        title: "sidebarApiKeys",
        href: "/{orgId}/settings/api-keys",
        icon: <KeyRound className="h-4 w-4" />
    },
    {
        title: "sidebarSettings",
        href: "/{orgId}/settings/general",
        icon: <Settings className="h-4 w-4" />
    }
];

export const adminNavItems: SidebarNavItem[] = [
    {
        title: "sidebarAllUsers",
        href: "/admin/users",
        icon: <Users className="h-4 w-4" />
    },
    {
        title: "sidebarResourceSessions",
        href: "/admin/resource-sessions",
        icon: <Clock className="h-4 w-4" />
    },
    {
        title: "sidebarApiKeys",
        href: "/admin/api-keys",
        icon: <KeyRound className="h-4 w-4" />
    },
    {
        title: "sidebarIdentityProviders",
        href: "/admin/idp",
        icon: <Fingerprint className="h-4 w-4" />
    },
    {
        title: "sidebarLicense",
        href: "/admin/license",
        icon: <TicketCheck className="h-4 w-4" />
    }
];
