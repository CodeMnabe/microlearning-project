/**
 * Barrel file dos repos de analytics.
 *
 * Este ficheiro junta todos os exports dos repos numa única entrada.
 *
 * Assim, a service pode importar tudo a partir de:
 * "@/lib/repos/analytics"
 *
 * Em vez de importar ficheiro por ficheiro.
 */


export * from "./analyticsBase.repo";
export * from "./analyticsUsers.repo";
export * from "./analyticsAssistants.repo";
export * from "./analyticsTemplates.repo";
export * from "./analyticsMessages.repo";
export * from "./analyticsAutomations.repo";
export * from "./analyticsPendingOutreach.repo";
export * from "./analyticsScheduledBroadcasts.repo";
export * from "./analyticsTrackedLinks.repo";
export * from "./analyticsDaily.repo";