/**
 * Selector hooks for the outreach module.
 *
 * Same discipline as `hooks/personal.ts`: read `db` once, derive with useMemo
 * on the exact slices used, return sorted, render-ready data. Components never
 * filter or sort the raw collections themselves.
 */
import { useMemo } from 'react'
import { usePersonalData } from '@/providers/personalDataContext'
import type {
  Company,
  Contact,
  MessageTemplate,
  Opportunity,
  OpportunityStage,
  OutreachSettings,
  Touch,
} from '@/types'

export function useOutreachSettings(): OutreachSettings {
  return usePersonalData().db.outreach
}

/** Companies by priority (high first), then name. Archived hidden unless asked. */
export function useCompanies(includeArchived = false): Company[] {
  const { companies } = usePersonalData().db
  return useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 }
    return companies
      .filter((c) => includeArchived || !c.archived)
      .slice()
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.name.localeCompare(b.name))
  }, [companies, includeArchived])
}

export function useCompanyMap(): Map<string, Company> {
  const { companies } = usePersonalData().db
  return useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
}

export function useCompany(id: string | undefined): Company | undefined {
  const map = useCompanyMap()
  return id ? map.get(id) : undefined
}

/** Contacts alphabetically; pass a companyId to scope. */
export function useContacts(companyId?: string): Contact[] {
  const { contacts } = usePersonalData().db
  return useMemo(
    () =>
      contacts
        .filter((c) => (companyId ? c.companyId === companyId : true))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contacts, companyId],
  )
}

export function useContactMap(): Map<string, Contact> {
  const { contacts } = usePersonalData().db
  return useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts])
}

export interface OpportunityFilter {
  companyId?: string
  contactId?: string
  stage?: OpportunityStage | OpportunityStage[]
  /** true = only open (non-terminal); false = only closed; undefined = all. */
  open?: boolean
}

export const TERMINAL_STAGES: readonly OpportunityStage[] = [
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
] as const

export function isTerminalStage(stage: OpportunityStage): boolean {
  return TERMINAL_STAGES.includes(stage)
}

/** Opportunities newest-updated first, optionally filtered. */
export function useOpportunities(filter: OpportunityFilter = {}): Opportunity[] {
  const { opportunities } = usePersonalData().db
  const { companyId, contactId, stage, open } = filter
  const stageKey = Array.isArray(stage) ? stage.join(',') : stage
  return useMemo(() => {
    const stages = stage ? (Array.isArray(stage) ? stage : [stage]) : null
    return opportunities
      .filter((o) => {
        if (companyId && o.companyId !== companyId) return false
        if (contactId && o.contactId !== contactId) return false
        if (stages && !stages.includes(o.stage)) return false
        if (open === true && isTerminalStage(o.stage)) return false
        if (open === false && !isTerminalStage(o.stage)) return false
        return true
      })
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    // stageKey stands in for the (possibly new-every-render) array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunities, companyId, contactId, stageKey, open])
}

export function useOpportunityMap(): Map<string, Opportunity> {
  const { opportunities } = usePersonalData().db
  return useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [opportunities])
}

export interface TouchFilter {
  companyId?: string
  contactId?: string
  opportunityId?: string
}

/** Touches newest first (by date, then time, then createdAt), optionally scoped. */
export function useTouches(filter: TouchFilter = {}): Touch[] {
  const { touches } = usePersonalData().db
  const { companyId, contactId, opportunityId } = filter
  return useMemo(
    () =>
      touches
        .filter((t) => {
          if (companyId && t.companyId !== companyId) return false
          if (contactId && t.contactId !== contactId) return false
          if (opportunityId && t.opportunityId !== opportunityId) return false
          return true
        })
        .slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.time ?? '').localeCompare(a.time ?? '') ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [touches, companyId, contactId, opportunityId],
  )
}

/** Templates by purpose then name. Archived hidden unless asked. */
export function useTemplates(includeArchived = false): MessageTemplate[] {
  const { templates } = usePersonalData().db
  return useMemo(
    () =>
      templates
        .filter((t) => includeArchived || !t.archived)
        .slice()
        .sort((a, b) => a.purpose.localeCompare(b.purpose) || a.name.localeCompare(b.name)),
    [templates, includeArchived],
  )
}

export function useTemplateMap(): Map<string, MessageTemplate> {
  const { templates } = usePersonalData().db
  return useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])
}
