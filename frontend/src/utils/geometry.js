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
