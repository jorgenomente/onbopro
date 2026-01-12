'use client';

import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import {
  getRichtextExtensions,
  RICHTEXT_CLASSNAME,
} from '@/lib/editor/richtextExtensions';

type LessonBlock = {
  block_id?: string;
  block_type: string;
  data?: Record<string, unknown>;
  position?: number;
};

type LessonBlocksRendererProps = {
  blocks: LessonBlock[];
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const getTextValue = (data: Record<string, unknown> | undefined) => {
  if (!data) return '';
  const value = data.text;
  return typeof value === 'string' ? value : '';
};

const getUrlValue = (data: Record<string, unknown> | undefined) => {
  if (!data) return '';
  const value = data.url;
  return typeof value === 'string' ? value : '';
};

const getLabelValue = (data: Record<string, unknown> | undefined) => {
  if (!data) return '';
  const value = data.label;
  return typeof value === 'string' ? value : '';
};

const getRichTextDoc = (data: Record<string, unknown> | undefined) => {
  if (!data) return null;
  const doc = data.doc;
  if (doc && typeof doc === 'object') {
    return doc as JSONContent;
  }
  if (typeof doc === 'string') {
    try {
      const parsed = JSON.parse(doc) as JSONContent;
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
};

function RichTextBlock({ doc }: { doc: JSONContent }) {
  const lastDocRef = useRef<string>('');
  const editor = useEditor({
    extensions: getRichtextExtensions({ openOnClick: true }),
    immediatelyRender: false,
    content: doc,
    editorProps: {
      attributes: {
        class: RICHTEXT_CLASSNAME,
      },
    },
    editable: false,
  });

  useEffect(() => {
    if (!editor) return;
    const serialized = JSON.stringify(doc);
    if (serialized === lastDocRef.current) return;
    lastDocRef.current = serialized;
    editor.commands.setContent(doc);
  }, [doc, editor]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

export function LessonBlocksRenderer({ blocks }: LessonBlocksRendererProps) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => {
        const key = block.block_id ?? `${block.block_type}-${block.position}`;
        const data = block.data ?? {};

        if (block.block_type === 'heading') {
          const text = getTextValue(data);
          return (
            <h2 key={key} className="text-base font-semibold text-zinc-900">
              {text || 'Sin titulo'}
            </h2>
          );
        }

        if (block.block_type === 'text') {
          const text = getTextValue(data);
          return (
            <p key={key} className="text-sm leading-relaxed text-zinc-700">
              {text || 'Sin contenido'}
            </p>
          );
        }

        if (block.block_type === 'link') {
          const url = getUrlValue(data);
          const label = getLabelValue(data) || url || 'Abrir enlace';
          if (!isNonEmptyString(url)) {
            return (
              <p key={key} className="text-sm text-zinc-500">
                Enlace sin URL.
              </p>
            );
          }
          return (
            <a
              key={key}
              className="text-sm font-semibold text-zinc-900 underline"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {label}
            </a>
          );
        }

        if (block.block_type === 'embed') {
          const url = getUrlValue(data);
          if (!isNonEmptyString(url)) {
            return (
              <p key={key} className="text-sm text-zinc-500">
                Embed sin URL.
              </p>
            );
          }
          return (
            <a
              key={key}
              className="text-sm text-zinc-900 underline"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir embed
            </a>
          );
        }

        if (block.block_type === 'divider') {
          return <hr key={key} className="border-zinc-200" />;
        }

        if (block.block_type === 'richtext') {
          const doc = getRichTextDoc(data);
          if (!doc) {
            return (
              <p key={key} className="text-sm text-zinc-500">
                Contenido sin formato.
              </p>
            );
          }
          return <RichTextBlock key={key} doc={doc} />;
        }

        if (process.env.NODE_ENV !== 'production') {
          return (
            <pre
              key={key}
              className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600"
            >
              {JSON.stringify(block, null, 2)}
            </pre>
          );
        }

        return null;
      })}
    </div>
  );
}
