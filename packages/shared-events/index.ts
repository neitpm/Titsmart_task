export interface BaseDomainEvent<T = any> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  companyId: string;
  timestamp: string;
  payload: T;
}

export type DomainEventType =
  | 'company.created'
  | 'company.updated'
  | 'user.created'
  | 'user.role_changed'
  | 'module.enabled'
  | 'module.expired'
  | 'project.created'
  | 'project.status_changed'
  | 'task.assigned'
  | 'task.completed'
  | 'task.approved'
  | 'expense.submitted'
  | 'expense.approved';

export class SimpleEventBus {
  private static handlers: Map<string, Array<(event: BaseDomainEvent) => Promise<void>>> = new Map();

  public static subscribe(eventType: DomainEventType, handler: (event: BaseDomainEvent) => Promise<void>) {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  public static async publish(event: BaseDomainEvent) {
    const list = this.handlers.get(event.eventType) || [];
    for (const handler of list) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Error handling event ${event.eventType}:`, err);
      }
    }
  }
}
