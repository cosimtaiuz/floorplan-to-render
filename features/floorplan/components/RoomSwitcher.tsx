"use client";

import { memo, useCallback, useMemo } from "react";
import type { RefObject } from "react";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { teleportTo } from "@/features/floorplan/lib/sceneCommands";
import type { RoomSpot } from "@/features/floorplan/types";

type IframeRef = RefObject<HTMLIFrameElement | null>;

/** Camera position on the floor plane as reported by the iframe. */
export type FloorPosition = { x: number; z: number };

const ROOM_BUTTON =
  "h-8 shrink-0 select-none rounded-md border px-3 text-xs font-medium backdrop-blur transition-colors focus-visible:outline-2 focus-visible:outline-accent";
const ROOM_ACTIVE = `${ROOM_BUTTON} border-accent bg-accent text-white`;
const ROOM_IDLE = `${ROOM_BUTTON} border-white/15 bg-black/55 text-zinc-100 hover:bg-black/75`;

type RoomButtonProps = {
  index: number;
  room: RoomSpot;
  active: boolean;
  onPick: (index: number) => void;
};

function RoomButtonComponent({ index, room, active, onPick }: RoomButtonProps) {
  const onClick = useCallback(() => onPick(index), [index, onPick]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`Go to ${room.name}`}
      className={active ? ROOM_ACTIVE : ROOM_IDLE}
    >
      {room.name}
    </button>
  );
}
const RoomButton = memo(RoomButtonComponent);

/** Index of the room whose standing point is closest to the camera, -1 without a position. */
export function nearestRoomIndex(rooms: RoomSpot[], position: FloorPosition | null): number {
  if (!position) return -1;
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < rooms.length; i++) {
    const d = Math.hypot(rooms[i].x - position.x, rooms[i].z - position.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

type Props = {
  iframeRef: IframeRef;
  position: FloorPosition | null;
};

/**
 * One button per room found on the plan. Clicking one teleports the visitor to
 * a standing point inside that room; the room the camera is currently in (the
 * nearest standing point) is highlighted while walking around.
 */
function RoomSwitcherComponent({ iframeRef, position }: Props) {
  const rooms = useFloorplanStore((s) => s.rooms);
  const activeIndex = useMemo(() => nearestRoomIndex(rooms, position), [rooms, position]);

  const onPick = useCallback(
    (index: number) => {
      const room = rooms[index];
      if (!room) return;
      teleportTo(iframeRef.current, { x: room.x, z: room.z, angleDeg: room.angleDeg });
      // Keep the keyboard on the 3D view so arrows / WASD keep working.
      iframeRef.current?.focus();
    },
    [iframeRef, rooms],
  );

  if (rooms.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Rooms"
      className="pointer-events-auto absolute top-3 right-3 left-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
    >
      {rooms.map((room, index) => (
        <RoomButton
          key={`${index}-${room.name}`}
          index={index}
          room={room}
          active={index === activeIndex}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

export const RoomSwitcher = memo(RoomSwitcherComponent);
