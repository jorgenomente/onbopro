'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import type { Editor, JSONContent } from '@tiptap/core';
import type { Level } from '@tiptap/extension-heading';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { LessonBlocksRenderer } from '@/components/learner/LessonBlocksRenderer';
import { LinkPicker } from '@/components/editor/LinkPicker';
import {
  SlashCommandMenu,
  type SlashCommandItem,
} from '@/components/editor/SlashCommandMenu';
import {
  getEmbedProvider,
  getRichtextExtensions,
  RICHTEXT_CLASSNAME,
  type EmbedProvider,
} from '@/lib/editor/richtextExtensions';

const DEFAULT_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const URL_REGEX = /^https?:\/\/\S+$/i;

type RichLessonEditorProps = {
  initialDoc: JSONContent | null;
  onSave: (doc: JSONContent) => Promise<string | null>;
  disabled?: boolean;
  legacyNotice?: string;
};

type PickerMode = 'link' | 'embed';

const getSerializedDoc = (doc: JSONContent) => JSON.stringify(doc);

const createSlashCommandExtension = (openEmbedPicker: () => void): Extension =>
  Extension.create({
    name: 'slash-command',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          items: ({ query }) => {
            const items: SlashCommandItem[] = [
              {
                title: 'Titulo',
                description: 'Heading grande',
              },
              {
                title: 'Subtitulo',
                description: 'Heading mediano',
              },
              {
                title: 'Texto',
                description: 'Parrafo normal',
              },
              {
                title: 'Divider',
                description: 'Separador horizontal',
              },
              {
                title: 'Video',
                description: 'Embed de video',
              },
            ];

            if (!query) return items;
            const search = query.toLowerCase();
            return items.filter((item) =>
              `${item.title} ${item.description}`
                .toLowerCase()
                .includes(search),
            );
          },
          command: ({ editor, range, props }) => {
            const label = props.title.toLowerCase();
            const chain = editor.chain().focus().deleteRange(range);

            if (label.includes('titulo') && !label.includes('subtitulo')) {
              chain.setHeading({ level: 2 }).run();
              return;
            }

            if (label.includes('subtitulo')) {
              chain.setHeading({ level: 3 }).run();
              return;
            }

            if (label.includes('texto')) {
              chain.setParagraph().run();
              return;
            }

            if (label.includes('divider')) {
              chain.setHorizontalRule().run();
              return;
            }

            if (label.includes('video')) {
              chain
                .insertContent({
                  type: 'embed',
                  attrs: { src: '', provider: '' },
                })
                .run();
              openEmbedPicker();
            }
          },
          render: () => {
            let component: ReactRenderer<SlashCommandItem[]> | null = null;
            let popup: HTMLDivElement | null = null;

            const updatePopup = (clientRect?: DOMRect | null) => {
              if (!popup || !clientRect) return;
              popup.style.left = `${clientRect.left + window.scrollX}px`;
              popup.style.top = `${clientRect.bottom + window.scrollY + 8}px`;
            };

            return {
              onStart: (props) => {
                const selectedIndex = (props as { selectedIndex?: number })
                  .selectedIndex;
                component = new ReactRenderer(SlashCommandMenu, {
                  props: {
                    items: props.items,
                    selectedIndex: selectedIndex ?? 0,
                  },
                  editor: props.editor,
                });

                popup = document.createElement('div');
                popup.className = 'z-50';
                popup.style.position = 'absolute';
                popup.appendChild(component.element);
                document.body.appendChild(popup);
                updatePopup(props.clientRect?.());
              },
              onUpdate: (props) => {
                const selectedIndex = (props as { selectedIndex?: number })
                  .selectedIndex;
                component?.updateProps({
                  items: props.items,
                  selectedIndex: selectedIndex ?? 0,
                });
                updatePopup(props.clientRect?.());
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup?.remove();
                  component?.destroy();
                  return true;
                }
                return false;
              },
              onExit: () => {
                popup?.remove();
                component?.destroy();
              },
            };
          },
        }),
      ];
    },
  });

export function RichLessonEditor({
  initialDoc,
  onSave,
  disabled,
  legacyNotice,
}: RichLessonEditorProps) {
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [pickerMode, setPickerMode] = useState<PickerMode>('link');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState('');
  const [initialDocValue] = useState<JSONContent>(initialDoc ?? DEFAULT_DOC);
  const [draftDoc, setDraftDoc] = useState<JSONContent>(initialDocValue);

  const lastSavedRef = useRef(getSerializedDoc(initialDocValue));
  const editorRef = useRef<Editor | null>(null);
  const saveStateRef = useRef(saveState);
  const isDirtyRef = useRef(false);
  const saveFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  const openPicker = useCallback((mode: PickerMode) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (mode === 'link') {
      const href = editor.getAttributes('link')?.href ?? '';
      setPickerValue(String(href ?? ''));
    } else {
      const src = editor.getAttributes('embed')?.src ?? '';
      setPickerValue(String(src ?? ''));
    }
    setPickerMode(mode);
    setPickerOpen(true);
  }, []);

  const openEmbedPicker = useCallback(() => {
    setPickerMode('embed');
    setPickerValue('');
    setPickerOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    const editorInstance = editorRef.current;
    if (!editorInstance || disabled) return;
    if (!isDirtyRef.current) return;
    if (saveStateRef.current === 'saving') return;

    setSaveState('saving');
    setSaveError('');
    const doc = editorInstance.getJSON();
    const errorMessage = await onSave(doc);

    if (errorMessage) {
      setSaveState('error');
      setSaveError(errorMessage);
      return;
    }

    const serialized = getSerializedDoc(doc);
    lastSavedRef.current = serialized;
    isDirtyRef.current = false;
    setIsDirty(false);
    setSaveState('saved');
    const savedAt = Date.now();
    setLastSavedAt(savedAt);
    setNow(savedAt);
  }, [disabled, onSave]);

  const extensions = useMemo(
    () => [
      ...getRichtextExtensions({ openOnClick: false }),
      createSlashCommandExtension(openEmbedPicker),
    ],
    [openEmbedPicker],
  );

  const handlePaste = useCallback((_view: unknown, event: ClipboardEvent) => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return false;
    const html = event.clipboardData?.getData('text/html')?.trim();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const trimmedText = text.trim();

    if (!html && text.includes('\n')) {
      const paragraphs = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (paragraphs.length) {
        const content = paragraphs.map((paragraph) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: paragraph }],
        }));
        editorInstance.chain().focus().insertContent(content).run();
        return true;
      }
    }

    if (!trimmedText || !URL_REGEX.test(trimmedText)) return false;

    const selection = editorInstance.state.selection;
    const hasSelection = !selection.empty;
    const provider = getEmbedProvider(trimmedText);

    if (hasSelection && !provider) {
      editorInstance.chain().focus().setLink({ href: trimmedText }).run();
      return true;
    }

    if (!hasSelection && provider) {
      const { $from } = selection;
      const isEmptyParagraph =
        $from.parent.type.name === 'paragraph' &&
        $from.parent.content.size === 0;
      if (isEmptyParagraph) {
        editorInstance
          .chain()
          .focus()
          .insertContent({
            type: 'embed',
            attrs: { src: trimmedText, provider },
          })
          .run();
        return true;
      }
    }

    return false;
  }, []);

  const handleKeyDown = useCallback(
    (_view: unknown, event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveFnRef.current?.();
        return true;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPicker('link');
        return true;
      }
      return false;
    },
    [openPicker],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: `${RICHTEXT_CLASSNAME} focus:outline-none min-h-[240px]`,
      },
      handlePaste,
      handleKeyDown,
    }),
    [handleKeyDown, handlePaste],
  );

  const editor = useEditor(
    {
      extensions,
      immediatelyRender: false,
      content: initialDocValue,
      editorProps,
      onUpdate: ({ editor: nextEditor }) => {
        const nextDoc = nextEditor.getJSON();
        setDraftDoc(nextDoc);
        const serialized = getSerializedDoc(nextDoc);
        const nextDirty = serialized !== lastSavedRef.current;
        setIsDirty(nextDirty);
        isDirtyRef.current = nextDirty;
        if (saveStateRef.current === 'saved') {
          setSaveState('idle');
        }
      },
    },
    [extensions, editorProps],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const handleSelection = () => {
      setSelectionVersion((prev) => prev + 1);
    };
    editor.on('selectionUpdate', handleSelection);
    return () => {
      editor.off('selectionUpdate', handleSelection);
    };
  }, [editor]);

  useEffect(() => {
    saveFnRef.current = () => {
      void handleSave();
    };
  }, [handleSave]);

  useEffect(() => {
    if (!lastSavedAt) return undefined;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  const handleApplyPicker = () => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    const url = pickerValue.trim();

    if (pickerMode === 'link') {
      if (!url) {
        editorInstance.chain().focus().unsetLink().run();
      } else {
        editorInstance
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: url })
          .run();
      }
    } else {
      const provider = getEmbedProvider(url);
      const attrs = { src: url, provider: provider ?? undefined } as {
        src: string;
        provider?: EmbedProvider;
      };
      if (!url) {
        editorInstance
          .chain()
          .focus()
          .updateAttributes('embed', { src: '', provider: '' })
          .run();
      } else if (editorInstance.isActive('embed')) {
        editorInstance.chain().focus().updateAttributes('embed', attrs).run();
      } else {
        editorInstance
          .chain()
          .focus()
          .insertContent({ type: 'embed', attrs })
          .run();
      }
    }

    setPickerOpen(false);
  };

  const handleRemovePicker = () => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    if (pickerMode === 'link') {
      editorInstance.chain().focus().unsetLink().run();
    } else {
      editorInstance
        .chain()
        .focus()
        .updateAttributes('embed', { src: '', provider: '' })
        .run();
    }
    setPickerOpen(false);
  };

  const handleConvertLineBreaks = () => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    const { $from } = editorInstance.state.selection;
    const parent = $from.parent;
    if (parent.type.name !== 'paragraph') return;

    const textWithBreaks: string[] = [];
    parent.content.forEach((node) => {
      if (node.type.name === 'hardBreak') {
        textWithBreaks.push('\n');
        return;
      }
      if (node.isText && node.text) {
        textWithBreaks.push(node.text);
      }
    });

    const raw = textWithBreaks.join('');
    if (!raw.includes('\n')) return;

    const paragraphs = raw
      .split(/\n+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: value }],
      }));

    if (!paragraphs.length) return;

    const from = $from.before();
    const to = $from.after();
    editorInstance
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent(paragraphs)
      .run();
  };

  const handleDebugSelection = () => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    const selection = editorInstance.state.selection;
    console.log('RichLessonEditor debug', {
      selection: { from: selection.from, to: selection.to },
      docChildCount: editorInstance.state.doc.childCount,
      parentType: selection.$from.parent.type.name,
      doc: editorInstance.getJSON(),
    });
  };

  const getSavedLabel = () => {
    if (!lastSavedAt) return '';
    const elapsedSeconds = Math.max(1, Math.round((now - lastSavedAt) / 1000));
    if (elapsedSeconds < 60) return 'Guardado recién';
    const elapsedMinutes = Math.round(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `Guardado hace ${elapsedMinutes}m`;
    const elapsedHours = Math.round(elapsedMinutes / 60);
    return `Guardado hace ${elapsedHours}h`;
  };
  const savedLabel = getSavedLabel();

  const previewBlocks = useMemo(
    () => [
      {
        block_type: 'richtext',
        data: {
          doc: draftDoc,
          version: 1,
        },
      },
    ],
    [draftDoc],
  );

  const styleValue = useMemo(() => {
    void selectionVersion;
    if (!editor) return 'paragraph';
    const selection = editor.state.selection;
    if (selection.empty) {
      const parent = selection.$from.parent;
      if (parent.type.name === 'heading') {
        return `h${parent.attrs.level}` as 'h1' | 'h2' | 'h3';
      }
      return 'paragraph';
    }

    const types = new Set<string>();
    editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (!node.isTextblock) return;
      if (node.type.name === 'heading') {
        types.add(`h${node.attrs.level}`);
        return;
      }
      if (node.type.name === 'paragraph') {
        types.add('paragraph');
      }
    });

    if (types.size !== 1) return 'mixed';
    return (types.values().next().value ?? 'paragraph') as
      | 'paragraph'
      | 'h1'
      | 'h2'
      | 'h3';
  }, [editor, selectionVersion]);

  const styleLabel =
    styleValue === 'h1'
      ? 'H1'
      : styleValue === 'h2'
        ? 'H2'
        : styleValue === 'h3'
          ? 'H3'
          : styleValue === 'mixed'
            ? 'Mixto'
            : 'Párrafo';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Editor de leccion
          </h2>
          <p className="text-xs text-zinc-500">
            Redacta la leccion y previsualiza como aprendiz.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {saveState === 'saving' && (
            <span className="text-zinc-500">Guardando…</span>
          )}
          {saveState === 'saved' && savedLabel && (
            <span className="text-emerald-600">{savedLabel}.</span>
          )}
          {saveState === 'error' && (
            <span className="text-red-600">{saveError}</span>
          )}
          {isDirty && saveState !== 'saving' && saveState !== 'error' ? (
            <span className="text-amber-600">Cambios sin guardar</span>
          ) : null}
          <button
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            type="button"
            onClick={() => void handleSave()}
            disabled={disabled}
          >
            Guardar
          </button>
        </div>
      </div>

      {legacyNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {legacyNotice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              className={`rounded-full border px-3 py-1 font-semibold ${
                editor?.isActive('bold')
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              Bold
            </button>
            <button
              className={`rounded-full border px-3 py-1 font-semibold ${
                editor?.isActive('italic')
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              Italic
            </button>
            <label className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600">
              <span>Estilo</span>
              <select
                className="bg-transparent text-xs font-semibold text-zinc-900 outline-none"
                value={styleValue}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'paragraph') {
                    editor?.chain().focus().setParagraph().run();
                    return;
                  }
                  const level: Level =
                    value === 'h1' ? 1 : value === 'h2' ? 2 : 3;
                  editor?.chain().focus().toggleHeading({ level }).run();
                }}
              >
                <option value="mixed" disabled>
                  Estilo
                </option>
                <option value="paragraph">Párrafo</option>
                <option value="h1">H1</option>
                <option value="h2">H2</option>
                <option value="h3">H3</option>
              </select>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                {styleLabel}
              </span>
            </label>
            <button
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
              type="button"
              onClick={handleConvertLineBreaks}
            >
              Convertir saltos
            </button>
            <button
              className={`rounded-full border px-3 py-1 font-semibold ${
                editor?.isActive('bulletList')
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              Lista
            </button>
            <button
              className={`rounded-full border px-3 py-1 font-semibold ${
                editor?.isActive('orderedList')
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              Ordenada
            </button>
            <button
              className={`rounded-full border px-3 py-1 font-semibold ${
                editor?.isActive('link')
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
              type="button"
              onClick={() => openPicker('link')}
            >
              Link
            </button>
            <button
              className={`rounded-full border px-3 py-1 font-semibold ${
                editor?.isActive('embed')
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
              type="button"
              onClick={() => openPicker('embed')}
            >
              Embed
            </button>
            {process.env.NODE_ENV !== 'production' ? (
              <button
                className="rounded-full border border-dashed border-zinc-200 px-3 py-1 text-[10px] font-semibold text-zinc-500"
                type="button"
                onClick={handleDebugSelection}
              >
                Debug
              </button>
            ) : null}
          </div>

          {pickerOpen ? (
            <LinkPicker
              label={pickerMode === 'link' ? 'Link' : 'Embed'}
              url={pickerValue}
              onChange={setPickerValue}
              onApply={handleApplyPicker}
              onRemove={handleRemovePicker}
              onClose={() => setPickerOpen(false)}
            />
          ) : null}

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <EditorContent editor={editor} />
          </div>
          <div className="text-xs text-zinc-500">
            Atajos: Cmd/Ctrl+S para guardar · Cmd/Ctrl+K para links · / para
            comandos
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              Vista como aprendiz
            </h3>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-600">
              Preview
            </span>
          </div>
          <LessonBlocksRenderer blocks={previewBlocks} />
        </div>
      </div>
    </div>
  );
}
