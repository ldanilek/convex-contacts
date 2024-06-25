import { Button } from "@/components/ui/button";
import { RequestForQueries, useMutation, useQueries, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { ForwardedRef, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { FunctionArgs, FunctionReturnType } from "convex/server";

function App() {
  return (
    <main className="container flex flex-row gap-8">
      <Menu />
      <ContactList />
    </main>
  );
}

function Menu() {
  const makeContact = useMutation(api.contacts.makeRandomContact);
  const count = useQuery(api.contacts.contactCount, {}) ?? 0;
  // Menu bar on the left is a fixed width, buttons positioned in a column.
  return (
    <div className="h-full w-16 flex flex-col gap-4 my-4">
      <p className="text-sm">{count} contacts</p>
      <Button onClick={() => {
            void makeContact({});
          }}>Add</Button>
      <Button>Settings</Button>
    </div>
  );
}

function ContactList() {
  // render ContactCard for each contact, in a column layout

  // Along the right-hand side of the page, have the alphabet in small font, going down next to the list of contacts.
  // The alphabet should be pinned to the right side of the page, and should not scroll with the list of contacts.
  // The alphabet should be on the right side of the page, and the ScrollingContacts should
  // take up the rest of the width.
  return (
    <div className="flex flex-row gap-4 flex-1">
      <ScrollingContacts />
      <Alphabet />
    </div>
  );
}

interface PaginatedContacts {
  results: (Doc<"contacts"> | undefined)[];
  scrollDown: () => void;
  scrollUp: () => void;
  scrollToLetter: (letter: string) => void;
}

type QueryState = {
  args: FunctionArgs<typeof api.contacts.contactsPage>,
};

const initialQueryState: QueryState = {
  args: {},
};

function usePaginatedContacts(): PaginatedContacts {
  const [nextQueryKey, setNextQueryKey] = useState(1);
  const [queryArgs, setQueryArgs] = useState<[number, QueryState][]>([[0, initialQueryState]]);
  const queries = useMemo(() => {
    const q: RequestForQueries = {};
    for (const queryArg of queryArgs) {
      q["" + queryArg[0]] = {
        query: api.contacts.contactsPage,
        args: queryArg[1].args,
      };
    }
    return q;
  }, [queryArgs]);
  const queryResults = useQueries(queries) as Record<string, FunctionReturnType<typeof api.contacts.contactsPage>>;
  const results = useMemo(() => {
    const results = [];
    for (let i = 0; i < queryArgs.length; i++) {
      const queryArg = queryArgs[i];
      const result = queryResults["" + queryArg[0]];
      if (!result) {
        results.push(undefined);
      } else if (result instanceof Error) {
        throw result;
      } else {
        if (queryArg[1].args.endIndexKey === undefined) {
          // Refetch query with a fixed endIndexKey.
          console.log(`refetching query ${queryArg[0]} with fixed endIndexKey`);
          setQueryArgs((prev) => {
            const endIndexKey = result.indexKeys.length > 0 ? result.indexKeys[result.indexKeys.length - 1] : [];
            return [...prev.slice(0, i),
              [queryArg[0], { args: { ...queryArg[1].args, endIndexKey } }],
              ...prev.slice(i + 1),
            ];
          });
        }
        results.push(...result.page);
      }
    }
    return results;
  }, [queryResults, queryArgs]);
  return {
    results,
    scrollDown: () => {
      console.log("scrolling down");
      const lastQuery = queryArgs[queryArgs.length - 1][1];
      if (lastQuery.args.endIndexKey === undefined) {
        // Last page still loading.
        return;
      }
      if (lastQuery.args.endIndexKey.length === 0) {
        // At the end.
        return;
      }
      setQueryArgs((prev) => {
        const last = prev[prev.length - 1];
        const lastIndexKey = last[1].args.endIndexKey;
        if (lastIndexKey === undefined) {
          return prev;
        }
        return [...prev, [nextQueryKey, { args: { startIndexKey: lastIndexKey } }]];
      });
      setNextQueryKey((prev) => prev + 1);
    },
    scrollUp: () => {},
    scrollToLetter: (_letter: string) => {},
  };
}

function ScrollingContacts() {
  const contacts = usePaginatedContacts();

  const loader = useRef(null);
  // When the last contact is on screen, load more.
  const loaderIndex = contacts.results.length - 1;
  useEffect(() => {
    const handleObserver = (entries: any) => {
      const target = entries[0];
      console.log("handle observer triggered", target.isIntersecting);
      if (target.isIntersecting) {
        contacts.scrollDown();
      }
    };
    const observer = new IntersectionObserver(handleObserver);
    if (loader.current) {
      observer.observe(loader.current);
      console.log("intersection observer created at index", loaderIndex);
    }
    return () => observer.disconnect();
  }, [loader, loaderIndex, contacts]);
  return (
    <div className="max-h-[100vh] overflow-y-auto flex flex-col flex-grow p-1">
      {contacts.results.map((contact, i) => {
        if (!contact) {
          return <div key={i} className="bg-gray-800 rounded-lg p-4 m-1">Loading...</div>;
        }
        return <ContactCard
          key={contact._id}
          contact={contact}
          ref={i === loaderIndex ? loader : null}
        />;
      })}
    </div>
  );
}

function Alphabet() {
  // The alphabet should be a column of letters, each letter should be a button that, when clicked, scrolls the list of contacts to the first contact whose surname starts with that letter.
  // Instead of normal button styling, the buttons should have blue text and no background.
  // They should also be small and vertically condensed.
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
        <button key={letter} className="text-blue-500 bg-transparent text-sm">{letter}</button>
      ))}
    </div>
  );
}

const ContactCard = forwardRef((
  {contact}: {contact: Doc<"contacts">},
  ref: ForwardedRef<HTMLDivElement>,
) => {
  return (
    <div ref={ref} className="bg-gray-800 rounded-lg p-4 m-1">
      <p className="text-lg">{contact.givenName} <span className="font-semibold">{contact.surname}</span></p>
      <p className="text-sm text-gray-400">{contact.phone}</p>
    </div>
  );
});

export default App;
