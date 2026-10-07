import { useEffect, useState } from "react";
import { authApi } from "../../api/auth";

export default function ProfileAvatar({ user, className = "h-16 w-16" }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const name = user?.display_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Account";
  const initials = ([user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("") || user?.email?.[0] || "A").toUpperCase();

  useEffect(() => {
    let active = true;
    let url;
    setPhotoUrl(null);
    if (user?.has_photo) {
      authApi.photo().then(({ data }) => {
        if (!active) return;
        url = URL.createObjectURL(data);
        setPhotoUrl(url);
      }).catch(() => { if (active) setPhotoUrl(null); });
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [user?.has_photo, user?.avatar_updated_at]);

  return photoUrl
    ? <img src={photoUrl} alt={name} className={`${className} shrink-0 rounded-full object-cover`} />
    : <span aria-label={`Initials for ${name}`} className={`${className} grid shrink-0 place-items-center rounded-full bg-brand-soft font-extrabold text-brand-strong`}>{initials}</span>;
}
