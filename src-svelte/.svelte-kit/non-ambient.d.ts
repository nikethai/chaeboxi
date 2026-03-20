
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/about" | "/image-creator" | "/session" | "/session/[id]" | "/settings" | "/settings/chat" | "/settings/default-models" | "/settings/document-parser" | "/settings/general" | "/settings/hotkeys" | "/settings/knowledge-base" | "/settings/mcp" | "/settings/provider" | "/settings/provider/[providerId]" | "/settings/web-search";
		RouteParams(): {
			"/session/[id]": { id: string };
			"/settings/provider/[providerId]": { providerId: string }
		};
		LayoutParams(): {
			"/": { id?: string; providerId?: string };
			"/about": Record<string, never>;
			"/image-creator": Record<string, never>;
			"/session": { id?: string };
			"/session/[id]": { id: string };
			"/settings": { providerId?: string };
			"/settings/chat": Record<string, never>;
			"/settings/default-models": Record<string, never>;
			"/settings/document-parser": Record<string, never>;
			"/settings/general": Record<string, never>;
			"/settings/hotkeys": Record<string, never>;
			"/settings/knowledge-base": Record<string, never>;
			"/settings/mcp": Record<string, never>;
			"/settings/provider": { providerId?: string };
			"/settings/provider/[providerId]": { providerId: string };
			"/settings/web-search": Record<string, never>
		};
		Pathname(): "/" | "/about" | "/image-creator" | `/session/${string}` & {} | "/settings" | "/settings/chat" | "/settings/default-models" | "/settings/document-parser" | "/settings/general" | "/settings/hotkeys" | "/settings/knowledge-base" | "/settings/mcp" | "/settings/provider" | `/settings/provider/${string}` & {} | "/settings/web-search";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}