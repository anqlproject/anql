import {
  COPY_COMMAND,
  CUT_COMMAND,
  type LexicalEditor,
  PASTE_COMMAND,
} from "lexical";

let lastActiveInput: HTMLInputElement | HTMLTextAreaElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "contextmenu",
    (e) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        lastActiveInput = target as HTMLInputElement | HTMLTextAreaElement;
      } else {
        lastActiveInput = null;
      }
    },
    true,
  );
}

export { lastActiveInput };

export async function safeWriteText(text: string) {
  try {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}


export function handleCopy(editor: LexicalEditor) {
  return async () => {
    if (lastActiveInput) {
      const start = lastActiveInput.selectionStart || 0;
      const end = lastActiveInput.selectionEnd || 0;
      const text = lastActiveInput.value.substring(start, end);
      if (text) {
        try {
          await safeWriteText(text);
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      editor.dispatchCommand(COPY_COMMAND, null);
    }
  };
}

export function handleCut(editor: LexicalEditor) {
  return async () => {
    if (lastActiveInput) {
      const start = lastActiveInput.selectionStart || 0;
      const end = lastActiveInput.selectionEnd || 0;
      const text = lastActiveInput.value.substring(start, end);
      if (text) {
        try {
          await safeWriteText(text);
          const currentValue = lastActiveInput.value;
          const newValue =
            currentValue.substring(0, start) + currentValue.substring(end);

          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(lastActiveInput),
            "value",
          )?.set;
          nativeInputValueSetter?.call(lastActiveInput, newValue);
          lastActiveInput.dispatchEvent(new Event("input", { bubbles: true }));
          lastActiveInput.dispatchEvent(new Event("change", { bubbles: true }));
          lastActiveInput.setSelectionRange(start, start);
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      editor.dispatchCommand(CUT_COMMAND, null);
    }
  };
}

export function handlePaste(editor: LexicalEditor) {
  return async () => {
    try {

      if (lastActiveInput) {
        const clipboardText = await (async () => {
          try {
            const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
            const text = await readText();
            return text || "";
          } catch {
            return await navigator.clipboard.readText();
          }
        })();

        const input = lastActiveInput;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const currentValue = input.value;
        const newValue =
          currentValue.substring(0, start) +
          clipboardText +
          currentValue.substring(end);

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(input),
          "value",
        )?.set;

        nativeInputValueSetter?.call(input, newValue);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        input.setSelectionRange(
          start + clipboardText.length,
          start + clipboardText.length,
        );
        input.focus();
      } else {
        try {
          const { readText, readHTML, hasHTML } = await import("tauri-plugin-clipboard-x-api");
          
          const data = new DataTransfer();
          const text = await readText();
          data.setData("text/plain", text);

          if (await hasHTML()) {
            const html = await readHTML();
            data.setData("text/html", html);
          }

          const event = new ClipboardEvent("paste", {
            clipboardData: data,
          });
          editor.dispatchCommand(PASTE_COMMAND, event);
        } catch (error) {
          console.error("Failed to read clipboard with clipboard-x:", error);
          // Fallback to navigator clipboard
          const clipboardItems = await navigator.clipboard.read();
          const data = new DataTransfer();

          for (const item of clipboardItems) {
            const types = item.types;
            for (const type of types) {
              const blob = await item.getType(type);
              const text = await blob.text();
              data.setData(type, text);
            }
          }

          const event = new ClipboardEvent("paste", {
            clipboardData: data,
          });
          editor.dispatchCommand(PASTE_COMMAND, event);
        }
      }
    } catch (error) {
      console.error("Failed to paste:", error);
    }
  };
}
