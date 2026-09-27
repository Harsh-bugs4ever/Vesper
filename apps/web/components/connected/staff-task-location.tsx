"use client";

import { MapPin } from "lucide-react";
import { Panel, PanelBody } from "@/components/ui/panel";

export type TaskLocation = {
  task_id: string;
  room_id: string;
  room_number: string;
  floor: number;
  image_url: string | null;
  image_alt: string | null;
};

export function StaffTaskLocation({ location, title }: { location: TaskLocation; title: string }) {
  return (
    <Panel>
      <PanelBody className="p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-serif text-xl text-sand-950">Resort 3D · Task location</h3>
            <p className="text-sm text-sand-700">{title}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-sage-50 px-3 py-1 text-sm font-medium text-sage-800">
            <MapPin className="h-4 w-4" aria-hidden="true" /> Floor {location.floor} · Room {location.room_number}
          </span>
        </div>
        <figure aria-label={`Task location: floor ${location.floor}, room ${location.room_number}`} className="relative h-52 overflow-hidden rounded-xl bg-sand-100 sm:h-64">
          {location.image_url ? (
            <img src={location.image_url} alt={location.image_alt || `Room ${location.room_number}`} className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center [perspective:850px]">
              <div className="relative h-32 w-60 rounded-lg border-2 border-sand-400 bg-sand-200 shadow-[12px_18px_0_0_#b5aa96] [transform:rotateX(54deg)_rotateZ(-35deg)] sm:h-40 sm:w-80">
                <span className="absolute left-4 top-3 text-xs font-semibold text-sand-700">FLOOR {location.floor}</span>
                <div className="absolute bottom-5 right-6 flex h-16 w-24 items-center justify-center rounded-md border-2 border-sage-700 bg-sage-500 text-lg font-bold text-white shadow-[5px_7px_0_0_#315341] sm:h-20 sm:w-28">
                  {location.room_number}
                </div>
              </div>
            </div>
          )}
          <figcaption className="absolute bottom-3 left-3 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-sand-800 shadow-sm">
            Floor {location.floor} · Room {location.room_number}
          </figcaption>
        </figure>
      </PanelBody>
    </Panel>
  );
}
