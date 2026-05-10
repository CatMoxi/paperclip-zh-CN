import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <select
        value={i18n.language?.startsWith("zh") ? "zh" : "en"}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent text-sm text-muted-foreground outline-none cursor-pointer hover:text-foreground transition-colors"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
