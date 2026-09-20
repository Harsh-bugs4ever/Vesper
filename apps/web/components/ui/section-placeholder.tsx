import * as React from "react";
import { format } from "date-fns";
import { Hammer } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

/**
 * A section that has a place in the navigation but is not built yet.
 *
 * It says so plainly and names the day it lands, because a nav link that leads to a 404
 * during a demo costs more trust than an honest "not yet". Delete the page when the real
 * section replaces it.
 */
export function SectionPlaceholder({
  title,
  description,
  day,
  covers,
}: {
  title: string;
  description: string;
  /** Sprint day this section is scheduled for. */
  day: string;
  /** What the finished section will hold. */
  covers: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} meta={format(new Date(), "EEE, d MMM yyyy")} />

      <Panel>
        <PanelBody className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-sand-500">
            <Hammer className="h-5 w-5" />
          </span>

          <div className="max-w-md">
            <h3 className="font-serif text-lg font-semibold text-sand-950">Scheduled for {day}</h3>
            <p className="mt-1 text-sm text-sand-600">
              This section is in the navigation so the shape of the product is clear. It is not
              wired up yet.
            </p>
          </div>

          <ul className="mt-1 space-y-1.5 text-sm text-sand-600">
            {covers.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-sand-300" />
                {item}
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}
