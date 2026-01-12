import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

export type EmbedProvider = 'youtube' | 'vimeo' | 'loom';

const YOUTUBE_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/;
const VIMEO_REGEX = /vimeo\.com\/(?:video\/)?(\d+)/;
const LOOM_REGEX = /loom\.com\/share\/([a-zA-Z0-9]+)/;

export const getEmbedProvider = (url: string): EmbedProvider | null => {
  if (YOUTUBE_REGEX.test(url)) return 'youtube';
  if (VIMEO_REGEX.test(url)) return 'vimeo';
  if (LOOM_REGEX.test(url)) return 'loom';
  return null;
};

export const getEmbedSrc = (url: string, provider?: EmbedProvider) => {
  if (!url) return '';
  const resolvedProvider = provider ?? getEmbedProvider(url);

  if (resolvedProvider === 'youtube') {
    const match = url.match(YOUTUBE_REGEX);
    const id = match?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }

  if (resolvedProvider === 'vimeo') {
    const match = url.match(VIMEO_REGEX);
    const id = match?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : url;
  }

  if (resolvedProvider === 'loom') {
    const match = url.match(LOOM_REGEX);
    const id = match?.[1];
    return id ? `https://www.loom.com/embed/${id}` : url;
  }

  return url;
};

export const RICHTEXT_CLASSNAME =
  'richtext-content text-sm leading-relaxed text-zinc-800 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol_li]:my-1 [&_a]:font-semibold [&_a]:text-zinc-900 [&_a]:underline';

export const EmbedNode = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      provider: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src =
      typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : '';
    const provider =
      typeof HTMLAttributes.provider === 'string'
        ? (HTMLAttributes.provider as EmbedProvider)
        : undefined;
    const iframeSrc = getEmbedSrc(src, provider);
    const wrapperClasses =
      'rich-embed w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50';
    const iframeClasses = 'h-full w-full';

    if (!src) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-embed': '',
          class: wrapperClasses,
        }),
        [
          'div',
          {
            class:
              'flex min-h-[120px] items-center justify-center px-4 text-xs text-zinc-500',
          },
          'Pegá una URL para embeber',
        ],
      ];
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-embed': src,
        class: wrapperClasses,
      }),
      [
        'iframe',
        {
          src: iframeSrc,
          class: iframeClasses,
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: 'true',
          loading: 'lazy',
        },
      ],
    ];
  },
});

export const getRichtextExtensions = ({
  openOnClick,
}: {
  openOnClick: boolean;
}) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Link.configure({
    openOnClick,
    autolink: true,
    linkOnPaste: true,
  }),
  EmbedNode,
];
