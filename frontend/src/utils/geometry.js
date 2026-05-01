export function isPointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; i += 2) {
        const xi = poly[i], yi = poly[i + 1];
        const xj = poly[j], yj = poly[j + 1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
        j = i;
    }
    return inside;
}

export function getCentroid(points) {
    let x = 0, y = 0;
    const n = points.length / 2;
    for (let i = 0; i < points.length; i += 2) {
        x += points[i];
        y += points[i + 1];
    }
    return { x: x / n, y: y / n };
}

// Returns a position inside the area polygon for US units,
// offset from the centroid (JP unit position) so they don't overlap.
export function getAreaUsPosition(area) {
    const centroid = getCentroid(area.points);
    const D = 115; // ~one unit width (100) + gap
    const candidates = [
        { x: centroid.x,            y: centroid.y - D },       // above
        { x: centroid.x + D,        y: centroid.y },           // right
        { x: centroid.x - D,        y: centroid.y },           // left
        { x: centroid.x,            y: centroid.y + D },       // below
        { x: centroid.x + D * 0.7,  y: centroid.y - D * 0.7 },// top-right
        { x: centroid.x - D * 0.7,  y: centroid.y - D * 0.7 },// top-left
        { x: centroid.x + D * 0.7,  y: centroid.y + D * 0.7 },// bottom-right
        { x: centroid.x - D * 0.7,  y: centroid.y + D * 0.7 },// bottom-left
    ];
    for (const pos of candidates) {
        if (isPointInPolygon(pos.x, pos.y, area.points)) return pos;
    }
    return centroid; // fallback (same as JP)
}
