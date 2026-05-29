const UA = 'BestAlbumsBot 0.2.0 (audiodude@gmail.com)';

function claimValue(claims, prop) {
  return claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

// Wikidata time like '+1997-05-21T00:00:00Z'; month/day may be '00' when unknown.
export function parseReleaseDate(timeStr) {
  if (!timeStr) return undefined;
  const m = timeStr.match(/^\+(\d{4})-(\d{2})-(\d{2})T/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  if (mo === '00') return y;
  if (d === '00') return `${y}-${mo}`;
  return `${y}-${mo}-${d}`;
}

export function albumLink(mbid, claims) {
  if (mbid) return `https://musicbrainz.org/release-group/${mbid}`;
  const allmusic = claimValue(claims, 'P1729');
  if (allmusic) return `https://www.allmusic.com/album/${allmusic}`;
  const amazon = claimValue(claims, 'P5749');
  if (amazon) return `https://www.amazon.com/dp/${amazon}`;
  return undefined;
}

export function parseAlbumEntity(qid, entity) {
  const claims = entity.claims ?? {};
  const mbid = claimValue(claims, 'P436');
  return {
    qid,
    title: entity.labels?.en?.value,
    mbid,
    spotifyId: claimValue(claims, 'P2205'),
    date: parseReleaseDate(claimValue(claims, 'P577')?.time),
    link: albumLink(mbid, claims),
    artistQid: claimValue(claims, 'P175')?.id,
  };
}

export function artistLabel(entity) {
  return entity.labels?.en?.value;
}

export async function fetchEntity(qid) {
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Wikidata ${qid}: HTTP ${res.status}`);
  const json = await res.json();
  return json.entities[qid];
}
