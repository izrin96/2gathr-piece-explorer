import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/site-header";

import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "2GATHR Piece Explorer" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="text-muted-foreground py-16 text-center text-sm">This page does not exist.</div>
  ),
  errorComponent: ({ error }) => (
    <div className="text-muted-foreground py-16 text-center text-sm">
      Something went wrong. {error.message}
    </div>
  ),
  component: RootDocument,
});

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`;

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="min-h-dvh">
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
