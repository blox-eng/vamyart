interface SkeletonTableProps {
    rows?: number;
    cols?: number;
}

const COL_WIDTHS = ["w-24", "w-40", "w-20", "w-32", "w-16", "w-28"];

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
    return (
        <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr key={r} className="border-b last:border-0">
                            {Array.from({ length: cols }).map((_, c) => (
                                <td key={c} className="px-4 py-3">
                                    <div
                                        className={`h-3 bg-gray-200 animate-pulse rounded ${
                                            COL_WIDTHS[(r + c) % COL_WIDTHS.length]
                                        }`}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
