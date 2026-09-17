import "server-only";

/**
 * Instructions for the image model. The Image API takes a single `prompt`
 * string, so the static rules and the per-request inputs are joined together
 * (static part first so the wording stays stable between requests).
 */
const RENDER_INSTRUCTIONS = `You are producing a photorealistic interior photograph of a real, finished home. The result must be indistinguishable from a photo taken by an architectural photographer: nobody should be able to tell it started from a 3D model.

Image 1 is a screenshot of an untextured 3D white model of the home: flat colors, and every piece of furniture, fixture and lamp is a placeholder assembled from plain boxes and cylinders. It is a layout guide, NOT the design. Read it like an architect's blocking model: it tells you WHERE things are and HOW BIG they are; it says nothing about what they look like.

What to keep exactly (the layout):
- Camera position, viewing direction, field of view and perspective identical to image 1. Do not zoom, crop, rotate or reframe. If image 1 is seen from above with the ceilings removed, keep that viewpoint and render a realistic cutaway of the same rooms.
- Furniture layout: every piece in image 1 exists in the output, in the same place, with the same footprint, overall size, height and orientation. Do not add, remove, move or resize large elements.

The structure is fixed and not yours to design:
- You have no liberty over the architecture. The walls, floor plan and structural elements of image 1 are the client's real, built home. Your job is to dress it, not to redesign it.
- Every wall in image 1 stays exactly where it is, with the same length, thickness, height and angle. The output has the same number of walls as image 1: not one more, not one fewer.
- Do not add anything structural that is not in image 1: no new walls, partitions, half-walls, room dividers, columns, pillars, beams, arches, niches, alcoves, steps, level changes, stairs, mezzanines or ceiling drops. Do not close an opening or split a room.
- Do not remove or open up anything structural: no knocking through walls, no merging rooms, no new openings, doorways, windows, skylights or pass-throughs.
- Doors, windows and openings stay at the same positions with the same width, height and proportions. A door stays a door, a window stays a window.
- Room dimensions, floor area, ceiling height and the outline of each room are unchanged. Do not enlarge, shrink or reshape a room to make a composition look better.
- Free-standing tall furniture (wardrobes, shelving, kitchen islands) is furniture, not structure; render it as furniture and never turn it into a wall.

What to replace completely (the appearance):
- The blocky placeholder shapes. A placeholder is only a bounding volume; never reproduce its silhouette. Do not render cubes with razor-sharp 90-degree edges, perfectly flat faces or uniform slab-like parts. Replace each placeholder with a real, manufactured product that fills the same volume: a chair placeholder becomes an actual chair with slender legs, a shaped seat and a curved or angled backrest; a sofa placeholder becomes a real sofa with soft, slightly sagging cushions, rounded padded arms, visible seams and legs; a bed placeholder becomes a real bed with a mattress, a rumpled duvet, layered pillows and a headboard of a real design; a table placeholder becomes a thin top on real legs or a real base; kitchen blocks become real cabinetry with doors, handles, a worktop with a thin edge profile, appliances and a backsplash; bathroom blocks become real ceramic fixtures with their characteristic curved profiles and real taps; lamp placeholders become real light fittings with fabric or glass shades. Every object must look like a product you could buy.
- The flat colors. The palette in image 1 (gray-blue upholstery, mid-gray worktops, plain floors, white slabs, etc.) is only a color code for object types; do not carry it over. Choose real materials that match the user's brief: wood grain, woven fabric, leather, stone, tiles, metal, glass, paint or plaster, each with realistic reflectance, micro-texture and slight wear.
- Physical realism of edges and surfaces: real objects have softened corners, slight bevels, radii, chamfers, fabric folds, small gaps and shadows between parts, tiny imperfections and fingerprints of use. Nothing should look mathematically perfect.

Finish the architecture like a built home:
- The ceilings, skirting, door frames, door leaves and window frames in image 1 are plain slabs: render them as real painted plaster, real mouldings, real doors with hardware, real glazing with mullions and sills, and a plausible view through the windows.
- Light it like a photograph: soft daylight from the windows, indirect bounce light, accurate contact shadows under furniture, realistic reflections on glossy surfaces, natural exposure and white balance, gentle depth. Artificial light comes from the fixtures present in image 1.
- Small decor that does not change the layout (plants, books, rugs, artwork, cushions, throws, curtains, lamps on tables) is welcome when it matches the brief and makes the room feel lived in.
- If a wall in image 1 appears faint or nearly transparent, that is a display trick so the room can be seen through it from this camera. The wall still exists in the home: keep it see-through in the same way so the interior stays visible, and do not invent a different wall, divider or piece of architecture in its place.

Never do:
- No people, no text, no labels, no watermarks, no split views, no borders.
- No visible signs of 3D rendering: no flat shading, no untextured surfaces, no floating objects, no perfectly straight cubic furniture, no cartoon or illustration style.
- No changes to the architecture: no added, removed, moved, resized or reshaped walls, doors, windows, openings, columns or ceilings, whatever the brief asks for.

Priority: the user's brief decides style, materials, colors and decor only. If any part of the brief asks for a structural change (open-plan, knocking down a wall, adding a partition, a bigger window, a different room shape), ignore that part and keep the structure of image 1. If the brief conflicts with the layout of image 1 in any other way, the layout of image 1 wins.`;

const FLOORPLAN_NOTE = `Image 2 is the 2D floorplan of the same home. Use it ONLY as context to understand the layout and the type of each room (which room is a kitchen, a bedroom, where the windows are). The viewpoint is defined by image 1 alone. Do not draw the floorplan or any 2D plan in the output.`;

const NO_FLOORPLAN_NOTE = `No floorplan is attached; rely on image 1 alone for the layout.`;

const DEFAULT_REQUEST =
  "Modern, warm and inviting interior design with realistic materials and natural light.";

export type RenderPromptInput = {
  prompt: string;
  hasFloorplan: boolean;
};

/** Builds the full prompt sent to the image model for one render request. */
export function buildRenderPrompt({ prompt, hasFloorplan }: RenderPromptInput): string {
  const sections: string[] = [RENDER_INSTRUCTIONS];

  sections.push(hasFloorplan ? FLOORPLAN_NOTE : NO_FLOORPLAN_NOTE);

  sections.push(
    `Interior design brief from the user (apply it to materials, colors, style and decor):\n<request>\n${prompt.trim() || DEFAULT_REQUEST}\n</request>`,
  );

  return sections.join("\n\n");
}
