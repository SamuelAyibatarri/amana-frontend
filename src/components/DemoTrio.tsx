import ChatDemoCard, { type ChatScript } from "@/components/ChatDemoCard";

const SEND_SCRIPT: ChatScript = {
  badge: "Send",
  opener: "hello",
  greeting: "Hey! I'm Amana. Buy, send, or check your balance — just say it.",
  request: "send 0.5 sol to 0803 123 4567",
  receiptTitle: "Sent 0.5 SOL",
  receiptLines: ["≈ ₦4,200 · Fee: Free"],
  receiptMeta: "Receipt #A3F9 · Balance 11.98 SOL",
  times: ["09:41", "09:41", "09:42", "09:42"],
  ariaLabel:
    "Demo chat: someone says hello to the Amana bot, asks to send 0.5 SOL, and gets an instant receipt with zero fees",
};

const BUY_SCRIPT: ChatScript = {
  badge: "Buy USDC",
  opener: "i want dollars",
  greeting: "Easy — I'll buy USDC for you at today's rate. How much?",
  request: "buy 200 usdc with naira",
  receiptTitle: "Bought 200 USDC",
  receiptLines: ["≈ ₦306,000 · Fee: Free"],
  receiptMeta: "Receipt #B71C · Balance 200 USDC",
  times: ["10:15", "10:15", "10:16", "10:16"],
  ariaLabel:
    "Demo chat: someone asks to buy dollars, orders 200 USDC with naira, and gets an instant receipt with zero fees",
};

const CASHOUT_SCRIPT: ChatScript = {
  badge: "Cash out",
  opener: "i need cash",
  greeting: "On it — bank transfer straight to your account. How much?",
  request: "withdraw 5000 naira to gtb …4281",
  receiptTitle: "Sent ₦5,000",
  receiptLines: ["To GTB ••••4281 · Fee: Free"],
  receiptMeta: "Receipt #C90D · Arrives in minutes",
  times: ["11:02", "11:02", "11:03", "11:03"],
  ariaLabel:
    "Demo chat: someone asks to withdraw 5000 naira to their bank account and gets an instant confirmation with zero fees",
};

/**
 * Circular fan of three demo chats: send-money front and center,
 * buy and cash-out flanking lower and tilted. Hovering any card
 * elevates it. Stacks vertically on mobile and MOTION-reduced setups.
 */
export default function DemoTrio() {
  return (
    <div className="mt-16 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-0">
      <div className="demo-tilt-l relative lg:-mr-10 lg:z-0 lg:pt-10">
        <ChatDemoCard script={BUY_SCRIPT} />
      </div>
      <div className="demo-front relative lg:z-10">
        <ChatDemoCard script={SEND_SCRIPT} />
      </div>
      <div className="demo-tilt-r relative lg:-ml-10 lg:z-0 lg:pt-10">
        <ChatDemoCard script={CASHOUT_SCRIPT} />
      </div>
    </div>
  );
}
