import { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../AuthProvider";
import { format } from "date-fns";

interface Item {
  id: string;
  text: string;
  done: boolean;
}

type DayData = {
  habits: Item[];
  goals: Item[];
};

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function useFirestoreItems(date: Date, kind: "habits" | "goals") {
  const { user } = useAuth();
  const key = dateKey(date);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Firestore document path: users/{uid}/days/{yyyy-MM-dd}
  const docRef = user ? doc(db, "users", user.uid, "days", key) : null;

  useEffect(() => {
    if (!docRef) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DayData;
          setItems(data[kind] ?? []);
        } else {
          setItems([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore read error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid, key, kind]);

  async function persist(nextItems: Item[]) {
    if (!docRef) return;

    // Optimistically update local state
    setItems(nextItems);

    // Write to Firestore (merge so we don't overwrite the other kind)
    try {
      await setDoc(docRef, { [kind]: nextItems }, { merge: true });
    } catch (err) {
      console.error("Firestore write error:", err);
    }
  }

  return { items, loading, persist };
}
