import { createCn } from "cn/config";

export const cn = createCn({
  extend: {
    theme: {
      text: ["caption", "body", "title", "code"],
      shadow: ["overlay", "dialog"],
      ease: ["standard"],
      animate: ["live"],
      tracking: ["caps"],
    },
  },
});
