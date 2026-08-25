// Script to download 1:200,000 Israel Geology from GSI FeatureServer and save optimized GeoJSON
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Douglas-Peucker line simplification algorithm
function getSqDist(p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
}

function getSqSegDist(p, p1, p2) {
    let x = p1[0], y = p1[1];
    let dx = p2[0] - x, dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = p2[0];
            y = p2[1];
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    let maxSqDist = sqTolerance;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
        const sqDist = getSqSegDist(points[i], points[first], points[last]);
        if (sqDist > maxSqDist) {
            index = i;
            maxSqDist = sqDist;
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
}

function simplifyPoints(points, tolerance) {
    if (!points || points.length <= 2) return points;
    const sqTolerance = tolerance * tolerance;
    const last = points.length - 1;
    const simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);
    return simplified;
}

function simplifyGeometry(geometry, tolerance = 0.0008) {
    if (!geometry || !geometry.coordinates) return;

    function simplifyRing(ring) {
        if (!Array.isArray(ring) || ring.length === 0) return ring;
        if (typeof ring[0][0] === 'number') {
            const res = simplifyPoints(ring, tolerance);
            // Ensure polygon ring remains closed
            if (res.length >= 3) {
                if (res[0][0] !== res[res.length - 1][0] || res[0][1] !== res[res.length - 1][1]) {
                    res.push(res[0]);
                }
                return res;
            }
            return ring;
        }
        return ring.map(simplifyRing);
    }

    geometry.coordinates = simplifyRing(geometry.coordinates);
}

function roundCoordinates(geometry) {
    if (!geometry || !geometry.coordinates) return;
    function recurse(arr) {
        if (typeof arr[0] === 'number') {
            arr[0] = Math.round(arr[0] * 10000) / 10000;
            arr[1] = Math.round(arr[1] * 10000) / 10000;
        } else {
            for (let i = 0; i < arr.length; i++) {
                recurse(arr[i]);
            }
        }
    }
    recurse(geometry.coordinates);
}

async function main() {
    console.log('1. Reading or downloading GSI 200k features...');
    const rawPath = path.resolve(__dirname, '../data/israel_geology.geojson');
    let allFeatures = [];

    if (fs.existsSync(rawPath)) {
        console.log('Reading existing data/israel_geology.geojson...');
        const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
        allFeatures = rawData.features;
    }

    console.log(`Simplifying ${allFeatures.length} polygons for ultra-fast low-zoom rendering...`);
    const simplifiedFeatures = [];

    allFeatures.forEach(f => {
        const copy = JSON.parse(JSON.stringify(f));
        simplifyGeometry(copy.geometry, 0.0012); // ~120m tolerance for regional low-zoom view
        roundCoordinates(copy.geometry);
        simplifiedFeatures.push(copy);
    });

    const geojson = {
        type: 'FeatureCollection',
        name: 'Israel_Geology_200k',
        features: simplifiedFeatures
    };

    const outPath = path.resolve(__dirname, '../data/israel_geology.geojson');
    fs.writeFileSync(outPath, JSON.stringify(geojson));
    const stats = fs.statSync(outPath);
    console.log(`Saved optimized ${outPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(console.error);

