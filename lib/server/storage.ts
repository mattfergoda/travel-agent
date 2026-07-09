import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppStateSchema, type AppState } from "@/lib/shared/schemas";

const DEFAULT_STATE_PATH = join(process.cwd(), "data", "state.json");

export function emptyAppState(): AppState {
  return AppStateSchema.parse({
    profile: {},
    messages: [],
    conflicts: [],
  });
}

export function createStorage(options: { filePath?: string } = {}) {
  const filePath = options.filePath ?? DEFAULT_STATE_PATH;

  return {
    async load(): Promise<AppState> {
      let raw: string;

      try {
        raw = await readFile(filePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return emptyAppState();
        }

        throw error;
      }

      const parsedJson: unknown = JSON.parse(raw);
      const parsedState = AppStateSchema.safeParse(parsedJson);

      if (!parsedState.success) {
        throw new Error(`Stored app state failed validation: ${parsedState.error.message}`);
      }

      return parsedState.data;
    },

    async save(state: AppState): Promise<void> {
      const parsedState = AppStateSchema.parse(state);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(parsedState, null, 2)}\n`, "utf8");
    },

    async reset(): Promise<AppState> {
      await rm(filePath, { force: true });
      return emptyAppState();
    },
  };
}
