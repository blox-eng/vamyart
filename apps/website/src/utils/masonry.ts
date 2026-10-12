// Greedy masonry: each piece goes, in order, into the column that is currently
// shortest. At equal widths a piece's height is 1/aspect, so that sum is the
// column height. Ties go to the leftmost column, which keeps reading order.
export function distributeColumns(aspects: number[], columns: number): number[][] {
    const placed: number[][] = Array.from({ length: columns }, () => []);
    const heights = new Array<number>(columns).fill(0);
    aspects.forEach((aspect, index) => {
        let shortest = 0;
        for (let c = 1; c < columns; c++) {
            if (heights[c] < heights[shortest]) shortest = c;
        }
        placed[shortest].push(index);
        heights[shortest] += 1 / aspect;
    });
    return placed;
}
