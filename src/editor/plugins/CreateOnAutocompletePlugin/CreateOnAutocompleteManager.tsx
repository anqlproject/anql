import { $createCodeNode } from "@lexical/code";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/extension";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $getSelection, $insertNodes, $isRangeSelection, $setSelection, LexicalEditor } from "lexical";
import { useEffect, useState } from "react";

import { HelpDialog } from "@/App/AppComponents/HelpPanel/HelpPanel";
import { $createListNode } from "@/editor/nodes/ListNode";
import { $createMathExpNode } from "@/editor/nodes/MathNode/MathExpNode";
import { $createTableNode } from "@/editor/nodes/TableNode/TableNode";
import { insertImageFromFile } from "@/editor/plugins/ImagesPlugin";

import { OptionName } from "./index";


export interface SelectNodeProps {
    editor: LexicalEditor;
    optionName: OptionName;
    clearOption: () => void;
}

export default function SelectNodeManager({ editor, optionName, clearOption }: SelectNodeProps) {
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    useEffect(() => {
        if (!optionName || optionName === "null") return;

        if (optionName === "Image") {
            clearOption();
            insertImageFromFile(editor);
            return;
        }

        if (optionName === "Help") {
            setIsHelpModalOpen(true);
            clearOption();
            return;
        }

        if (optionName === "Line") {
            editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
            clearOption();
            return;
        }

        if (optionName === "Table") {
            editor.update(() => {
                const tableNode = $createTableNode([{ a: "" }], [{ header: "", id: "a" }]);
                $insertNodes([tableNode]);
                $setSelection(null);
            });
            clearOption();
            return;
        }

        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                switch (optionName) {
                    case "Math":
                        $setBlocksType(selection, () => $createMathExpNode());
                        break;
                    case "Code":
                        $setBlocksType(selection, () => $createCodeNode());
                        break;
                    case "Heading 1":
                        $setBlocksType(selection, () => $createHeadingNode("h1"));
                        break;
                    case "Heading 2":
                        $setBlocksType(selection, () => $createHeadingNode("h2"));
                        break;
                    case "Heading 3":
                        $setBlocksType(selection, () => $createHeadingNode("h3"));
                        break;
                    case "Number List":
                        $setBlocksType(selection, () => $createListNode("number"));
                        break;
                    case "Bullet List":
                        $setBlocksType(selection, () => $createListNode("bullet"));
                        break;
                    case "Check List":
                        $setBlocksType(selection, () => $createListNode("check"));
                        break;
                    case "Quote":
                        $setBlocksType(selection, () => $createQuoteNode());
                        break;
                }
            }
        });

        clearOption();
    }, [editor, optionName, clearOption]);

    return (
        <>
            <HelpDialog
                isOpen={isHelpModalOpen}
                onClose={() => {
                    setIsHelpModalOpen(false);
                    setTimeout(() => editor.focus(), 10);
                }}
            />
        </>
    );
}