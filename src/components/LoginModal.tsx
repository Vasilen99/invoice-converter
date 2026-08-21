"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
// import { Mail, ArrowRight, Sparkles } from "lucide-react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/components/radix/dialog";
import { createClient } from "../../utility/supabase/client";
import { globalStore } from "@/store/global";
import { userStore } from "@/store/user";
import { usePathname } from "next/navigation";
//import { EMAIL_REGEX, server } from "../../utility/constants";
import { server } from "../../utility/constants";

// import { callApi } from "../../utility/hooks/apiFetch";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29A7.19 7.19 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
);

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onClose }) => {
  const t = useTranslations("auth");

  // const [state, setState] = useState({ email: "" });
  // const [step, setStep] = useState<"email" | "code">("email");
  // const [code, setCode] = useState("");
  // const [isVerifying, setIsVerifying] = useState(false);
  const supabase = createClient();
  const globalState = globalStore();
  const userState = userStore();
  const currentPathname = usePathname();

  // const validateLoginData = () => {
  //   if (!state.email.trim().length) {
  //     globalState.setAlertStatus({
  //       statusContent: "Моля, попълнете email адрес!",
  //       statusHeader: "Грешка !",
  //       status: "error",
  //     });

  //     return false;
  //   }
  //   if (!EMAIL_REGEX.test(state.email.trim())) {
  //     globalState.setAlertStatus({
  //       statusContent: "Моля, въведете правилен email!",
  //       statusHeader: "Грешка !",
  //       status: "error",
  //     });

  //     return false;
  //   }
  //   return true;
  // };

  // const loginUser = async () => {
  //   if (!validateLoginData()) {
  //     return;
  //   }

  //   const result = await callApi("/auth/user/find", {
  //     method: "POST",
  //     body: JSON.stringify({ data: { email: state.email.trim() } }),
  //   });

  //   const signInResult = await supabase.auth.signInWithOtp({
  //     email: state.email,
  //     options: {
  //       shouldCreateUser: result && result.id ? false : true,
  //     },
  //   });

  //   if (signInResult.error) {
  //     globalState.setAlertStatus({
  //       status: "error",
  //       statusHeader: "Грешка при изпращане",
  //       statusContent:
  //         "Не успяхме да изпратим имейл за потвърждение. Моля, опитайте отново.",
  //     });
  //     return;
  //   }

  //   globalState.setAlertStatus({
  //     status: "success",
  //     statusHeader: "Успешно изпратен имейл!",
  //     statusContent:
  //       "Моля проверете пощата си за 6-цифрен код и го въведете по-долу.",
  //   });

  //   setStep("code");
  //   setCode("");
  // };

  //TODO: Implement email login verification with code input. The following function is commented out and needs to be implemented in the future.
  // const verifyCode = async () => {
  //   const trimmedCode = code.trim();
  //   if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
  //     globalState.setAlertStatus({
  //       status: "error",
  //       statusHeader: "Невалиден код",
  //       statusContent: "Моля, въведете точно 6-цифрен код от имейла си.",
  //     });
  //     return;
  //   }

  //   setIsVerifying(true);
  //   const { error } = await supabase.auth.verifyOtp({
  //     email: state.email,
  //     token: trimmedCode,
  //     type: "email",
  //   });
  //   setIsVerifying(false);

  //   if (error) {
  //     globalState.setAlertStatus({
  //       status: "error",
  //       statusHeader: "Грешен код",
  //       statusContent:
  //         "Кодът е невалиден или е изтекъл. Моля, опитайте отново.",
  //     });
  //     return;
  //   }

  //   globalState.setAlertStatus({
  //     status: "success",
  //     statusHeader: "Успешен вход!",
  //     statusContent: "Влязохте успешно в акаунта си.",
  //   });

  //   userState.fetchUser();
  //   globalState.setIsLoginModalOpen(false);
  //   setStep("email");
  //   setCode("");
  // };

  const socialLogin = async (customProvider: "facebook" | "google") => {
    try {
      globalState.setIsLoading(true);

      if (typeof window !== "undefined") {
        sessionStorage.setItem("loginReturnPath", currentPathname);
      }

      const redirectTo = `${server}/api/auth/social-login-callback?next=${encodeURIComponent(currentPathname)}`;

      const result = await supabase.auth.signInWithOAuth({
        provider: customProvider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });

      if (result.error) {
        globalState.setAlertStatus({
          status: "error",
          statusHeader: "Грешка при вход",
          statusContent: `Не успяхме да ви логнем чрез ${customProvider === "google" ? "Google" : "Facebook"}. Моля, опитайте отново.`,
        });
        return;
      }

      // Web browser — OAuth redirect was initiated successfully.
      globalState.setAlertStatus({
        status: "success",
        statusHeader: "Пренасочване...",
        statusContent: `Пренасочваме ви към ${customProvider === "google" ? "Google" : "Facebook"} за потвърждение.`,
      });

      userState.fetchUser();
    } catch (err) {
      console.error(err);
      globalState.setAlertStatus({
        status: "error",
        statusHeader: "Грешка при вход",
        statusContent: `Възникна проблем при влизането чрез ${customProvider === "google" ? "Google" : "Facebook"}. Моля, опитайте отново или използвайте друг начин за вход.`,
      });
    } finally {
      globalState.setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent
        from="bottom"
        overlayClassName="bg-background/60 backdrop-blur-md"
        className="glass max-w-[min(450px,calc(100%-2rem))] rounded-2xl border border-border p-8 shadow-2xl"
      >
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            show: {
              transition: { staggerChildren: 0.07, delayChildren: 0.1 },
            },
          }}
          className="flex flex-col gap-5"
        >
          {[
            <div
              key="head"
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background">
                <Sparkles size={22} />
              </div>
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t("subtitle")}
              </DialogDescription>
            </div>,

            // <form
            //   key="form"
            //   onSubmit={loginUser}
            //   className="flex flex-col gap-3"
            // >
            //   <label htmlFor="login-email" className="text-sm font-medium">
            //     {t("emailLabel")}
            //   </label>
            //   <div className="relative">
            //     <Mail
            //       size={16}
            //       className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            //     />
            //     <input
            //       id="login-email"
            //       type="email"
            //       required
            //       value={state.email}
            //       onChange={(e) => setState({ email: e.target.value })}
            //       placeholder={t("emailPlaceholder")}
            //       className="w-full rounded-lg border border-border bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
            //     />
            //   </div>
            //   <motion.button
            //     type="submit"
            //     whileHover={{ scale: 1.02 }}
            //     whileTap={{ scale: 0.98 }}
            //     className="btn-glow group mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background"
            //   >
            //     {t("continueWithEmail")}
            //     <ArrowRight
            //       size={16}
            //       className="transition-transform group-hover:translate-x-0.5"
            //     />
            //   </motion.button>
            // </form>,

            // <div key="sep" className="flex items-center gap-3">
            //   <div className="h-px flex-1 bg-border" />
            //   <span className="text-xs uppercase tracking-wider text-muted-foreground">
            //     {t("or")}
            //   </span>
            //   <div className="h-px flex-1 bg-border" />
            // </div>,

            <motion.button
              key="google"
              type="button"
              onClick={() => socialLogin("google")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <GoogleIcon />
              {t("continueWithGoogle")}
            </motion.button>,

            <p
              key="terms"
              className="text-center text-xs leading-relaxed text-muted-foreground"
            >
              {t("terms")}
            </p>,
          ].map((node, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              {node}
            </motion.div>
          ))}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
