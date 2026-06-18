'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchEvents } from '@/lib/admin/fetchData';
import { toCustomEventsConfig, todayIsoJst } from '@/lib/easyMode';
import type { AdminEvent, EasyModeCategorySetting } from '@/types/admin';

export default function CustomEventsCategory({ category }: { category: EasyModeCategorySetting }) {
  const config = toCustomEventsConfig(category.config);
  const [events, setEvents] = useState<AdminEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchEvents().then((items) => {
      if (!mounted) return;
      setEvents(items);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const today = todayIsoJst();
    const weekEnd = todayIsoJst(6);

    return events.filter((event) => {
      const startDate = event.startAt.slice(0, 10);
      if (config.filter === 'today') {
        return startDate === today;
      }
      if (config.filter === 'this_week') {
        return startDate >= today && startDate <= weekEnd;
      }
      return startDate >= today;
    });
  }, [config.filter, events]);

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-4">
        <p className="text-[1.05em] font-extrabold text-slate-900">{category.name}</p>
        {filteredEvents.length === 0 ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-6 text-[0.9em] text-slate-500">
            表示できるイベントはありません。
          </p>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <article key={event.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-2">
                  <p className="text-[0.95em] font-extrabold text-slate-900">{event.title}</p>
                  <p className="text-[0.82em] text-slate-700">
                    {event.startAt.slice(0, 16).replace('T', ' ')} 〜 {event.endAt.slice(0, 16).replace('T', ' ')}
                  </p>
                  {event.location ? <p className="text-[0.8em] text-slate-600">場所: {event.location}</p> : null}
                  {config.showNotes && event.description ? (
                    <p className="text-[0.8em] leading-relaxed text-slate-600">{event.description}</p>
                  ) : null}
                  {config.showParticipants ? (
                    <p className="rounded-2xl bg-slate-100 px-4 py-3 text-[0.78em] font-semibold text-slate-700">
                      参加人数表示は今後の参加者連携で拡張できます。
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
