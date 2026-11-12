import { useEffect, useState } from "react";
import { corridorFiles, type CorridorFile, type CorridorNotice } from "./corridor-notice";

/**
 * Shown under the views while a prepared corridor is on screen: the
 * OpenStreetMap attribution, the licence of the corridor data, and the data
 * files with the import script, each to save as a plain file.
 */
export function CorridorNoticePanel({ corridorId, notice }: { corridorId: string; notice: CorridorNotice }) {
  const [files, setFiles] = useState<{ file: CorridorFile; url: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let made: string[] = [];
    void corridorFiles(corridorId).then((loaded) => {
      if (cancelled) return;
      const withUrls = loaded.map((file) => ({ file, url: URL.createObjectURL(new Blob([file.text], { type: "text/plain" })) }));
      made = withUrls.map((one) => one.url);
      setFiles(withUrls);
    });
    return () => {
      cancelled = true;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [corridorId, open]);

  return (
    <section className="corridor-notice" aria-label="Map data" data-testid="corridor-notice">
      <p data-testid="osm-attribution">
        Map data{" "}
        <a href={notice.copyrightUrl} target="_blank" rel="noreferrer">
          {notice.attribution}
        </a>
        . The corridor data is a database made from OpenStreetMap and is offered under the{" "}
        <a href={notice.licenceUrl} target="_blank" rel="noreferrer">
          {notice.licenceName}
        </a>
        .
      </p>
      <details onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary data-testid="corridor-files-toggle">The corridor data and the import script</summary>
        {files.length === 0 ? (
          <p>Loading…</p>
        ) : (
          <ul data-testid="corridor-files">
            {files.map(({ file, url }) => (
              <li key={file.name}>
                <a href={url} download={file.name}>
                  {file.name}
                </a>{" "}
                · {file.about}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
