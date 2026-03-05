import type { Track, Clip, TextProperties } from '../store/timelineStore';
import { DEFAULT_TEXT_PROPERTIES } from '../store/timelineStore';

export interface SubtitleEntry {
  startTime: number;
  endTime: number;
  text: string;
  style?: Partial<TextProperties>;
}

// --- SRT ---

function parseSRTTime(timeStr: string): number {
  // 00:01:23,456 → seconds
  const parts = timeStr.trim().split(':');
  if (parts.length !== 3) return 0;
  const [h, m, rest] = parts;
  const [s, ms] = rest.split(',');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms || '0') / 1000;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    // lines[0] = index, lines[1] = timecode, lines[2+] = text
    const timeParts = lines[1].split('-->');
    if (timeParts.length !== 2) continue;
    const startTime = parseSRTTime(timeParts[0]);
    const endTime = parseSRTTime(timeParts[1]);
    const text = lines.slice(2).join('\n').trim();
    if (text) {
      entries.push({ startTime, endTime, text });
    }
  }
  return entries;
}

export function exportSRT(entries: SubtitleEntry[]): string {
  return entries
    .map((entry, i) => {
      return `${i + 1}\n${formatSRTTime(entry.startTime)} --> ${formatSRTTime(entry.endTime)}\n${entry.text}`;
    })
    .join('\n\n') + '\n';
}

// --- ASS ---

function parseASSTime(timeStr: string): number {
  // 0:01:23.45 → seconds
  const parts = timeStr.trim().split(':');
  if (parts.length !== 3) return 0;
  const [h, m, rest] = parts;
  const [s, cs] = rest.split('.');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(cs || '0') / 100;
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function parseASS(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = content.split('\n');
  let inEvents = false;
  let formatFields: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '[Events]') {
      inEvents = true;
      continue;
    }
    if (trimmed.startsWith('[') && trimmed !== '[Events]') {
      inEvents = false;
      continue;
    }
    if (!inEvents) continue;

    if (trimmed.startsWith('Format:')) {
      formatFields = trimmed.substring(7).split(',').map((f) => f.trim().toLowerCase());
      continue;
    }
    if (trimmed.startsWith('Dialogue:')) {
      const rest = trimmed.substring(9).trim();
      // Split by comma, but the last field (Text) can contain commas
      const parts = rest.split(',');
      if (parts.length < formatFields.length) continue;

      const startIdx = formatFields.indexOf('start');
      const endIdx = formatFields.indexOf('end');
      const textIdx = formatFields.indexOf('text');
      if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;

      const startTime = parseASSTime(parts[startIdx]);
      const endTime = parseASSTime(parts[endIdx]);
      // Text field is everything from textIdx onwards (may contain commas)
      const text = parts.slice(textIdx).join(',').trim()
        // Remove ASS override tags like {\b1}, {\pos(x,y)}, etc.
        .replace(/\{[^}]*\}/g, '')
        // Replace \N with newline
        .replace(/\\N/g, '\n');

      if (text) {
        entries.push({ startTime, endTime, text });
      }
    }
  }
  return entries;
}

export function exportASS(entries: SubtitleEntry[]): string {
  const header = `[Script Info]
Title: qcut Export
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogues = entries
    .map((entry) => {
      const text = entry.text.replace(/\n/g, '\\N');
      return `Dialogue: 0,${formatASSTime(entry.startTime)},${formatASSTime(entry.endTime)},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  return header + dialogues + '\n';
}

// --- Track conversion ---

export function subtitlesToTrack(entries: SubtitleEntry[], trackName = 'Subtitle'): Track {
  const clips: Clip[] = entries.map((entry, i) => ({
    id: `text-${Date.now()}-${i}`,
    name: entry.text.substring(0, 20),
    startTime: entry.startTime,
    duration: entry.endTime - entry.startTime,
    color: '#e6a817',
    filePath: '',
    sourceStartTime: 0,
    sourceEndTime: 0,
    textProperties: {
      ...DEFAULT_TEXT_PROPERTIES,
      text: entry.text,
      ...(entry.style ?? {}),
    },
  }));

  return {
    id: `track-text-${Date.now()}`,
    type: 'text',
    name: trackName,
    clips,
  };
}

export function trackToSubtitles(track: Track): SubtitleEntry[] {
  return track.clips
    .filter((clip) => clip.textProperties)
    .map((clip) => ({
      startTime: clip.startTime,
      endTime: clip.startTime + clip.duration,
      text: clip.textProperties!.text,
    }));
}
