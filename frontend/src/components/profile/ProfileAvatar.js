import { useEffect, useState } from "react";
import { authApi } from "../../api/auth";

export default function ProfileAvatar({ user, className = "h-16 w-16", otherUser = false }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const name = user?.display_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Account";
  const nameParts = (user?.display_name || "").trim().split(/\s+/).filter(Boolean);
  const initials = ([user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("")
    || (nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` : nameParts[0]?.[0])
    || user?.email?.[0] || "A").toUpperCase();

  useEffect(() => {
    let active = true;
    let url;
    setPhotoUrl(null);
    if (user?.has_photo && (!otherUser || user?.id)) {
      (otherUser ? authApi.userPhoto(user.id) : authApi.photo()).then(({ data }) => {
        if (!active) return;
        url = URL.createObjectURL(data);
        setPhotoUrl(url);
      }).catch(() => { if (active) setPhotoUrl(null); });
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [user?.id, user?.has_photo, user?.avatar_updated_at, otherUser]);

  return photoUrl
    ? <img src={photoUrl} alt={name} className={`${className} shrink-0 rounded-full object-cover`} />
    : <span aria-label={`Initials for ${name}`} className={`${className} grid shrink-0 place-items-center rounded-full bg-brand-soft font-extrabold text-brand-strong`}>{initials}</span>;
}
