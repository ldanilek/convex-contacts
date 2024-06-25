import { Button } from "@/components/ui/button";
import { useMutation, useQueries, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { ForwardedRef, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    </div>
  );
}

function ContactList() {
  // render ContactCard for each contact, in a column layout
  const [clickedLetter, setClickedLetter] = useState<string | undefined>(undefined);

  // Along the right-hand side of the page, have the alphabet in small font, going down next to the list of contacts.
  // The alphabet should be pinned to the right side of the page, and should not scroll with the list of contacts.
  // The alphabet should be on the right side of the page, and the ScrollingContacts should
  // take up the rest of the width.
  return (
    <div className="flex flex-row gap-4 flex-1">
      <ScrollingContacts clickedLetter={clickedLetter} />
      <Alphabet onClick={setClickedLetter} />
    </div>
  );
}

interface PaginatedContacts {
  results: (Doc<"contacts"> | undefined)[];
  scrollDown: () => void;
  scrollUp: () => void;
  scrollToLetter: (letter: string) => void;
}

function usePaginatedContacts(): PaginatedContacts {
  const [queries, setQueries] = useState<[number[], Record<string, { query: typeof api.contacts.contactsPage, args: FunctionArgs<typeof api.contacts.contactsPage> }>]>(
    [
      [0],
      {"0": { query: api.contacts.contactsPage, args: {} }},
    ]
  );
  console.log(`queries: ${JSON.stringify(queries[0])} ${JSON.stringify(queries[1])}`);
  const queryResults = useQueries(queries[1]) as Record<string, FunctionReturnType<typeof api.contacts.contactsPage>>;
  const results = useMemo(() => {
    const results = [];
    for (const queryKey of queries[0]) {
      const queryArg = queries[1]["" + queryKey];
      const result = queryResults["" + queryKey];
      if (!result) {
        results.push(undefined);
      } else if (result instanceof Error) {
        throw result;
      } else {
        if (queryArg.args.endIndexKey === undefined) {
          // Refetch query with a fixed endIndexKey.
          console.log(`refetching query ${queryKey} with fixed endIndexKey`);
          setQueries((prev) => {
            const queryArg = prev[1]["" + queryKey];
            const endIndexKey = result.indexKeys.length > 0 ? result.indexKeys[result.indexKeys.length - 1] : [];
            const startIndexKey = queryArg.args.startIndexKey ?? [];
            const newArgs = queryArg.args.order === "desc" ?
              {
                startIndexKey: endIndexKey,
                endIndexKey: startIndexKey,
                startInclusive: queryArg.args.endInclusive ?? true,
                endInclusive: queryArg.args.startInclusive ?? false,
              } :
              { ...queryArg.args, startIndexKey, endIndexKey };
            console.log(`newArgs: ${JSON.stringify(newArgs)} based on ${JSON.stringify(queryArg.args)} and ${JSON.stringify(result.indexKeys)}`);
            return [prev[0], {...prev[1], [queryKey]: { query: queryArg.query, args: newArgs }}];
          });
        }
        const page = result.page.slice();
        if (queryArg.args.order === "desc") {
          page.reverse();
        }
        results.push(...page);
      }
    }
    return results;
  }, [queryResults, queries]);
  const scrollDown = useCallback(() => {
    setQueries((prev) => {
      console.log("scrolling down");
      const lastQueryKey = prev[0][prev[0].length - 1];
      const lastQuery = prev[1]["" + lastQueryKey];
      const lastArgs = lastQuery.args;
      const lastIndexKey = lastArgs.endIndexKey;
      if (lastIndexKey === undefined) {
        // Last page still loading.
        return prev;
      }
      if (lastIndexKey.length === 0) {
        // At the end.
        return prev;
      }
      const nextQueryKey = prev[0].length;
      return [[...prev[0], nextQueryKey], {
        ...prev[1],
        [nextQueryKey]: { query: lastQuery.query, args: { startIndexKey: lastIndexKey } },
      }];
    });
  }, []);
  const scrollUp = useCallback(() => {
    setQueries((prev) => {
      console.log("scrolling up");
      const firstQueryKey = prev[0][0];
      const firstQuery = prev[1]["" + firstQueryKey];
      const firstArgs = firstQuery.args;
      const firstIndexKey = firstArgs.startIndexKey;
      if (firstIndexKey === undefined || firstIndexKey.length === 0) {
        return prev;
      }
      if (firstArgs.endIndexKey === undefined || firstArgs.order === "desc") {
        // First page still loading or refetching.
        return prev;
      }
      const firstIncluded = firstArgs.startInclusive ?? false;
      const nextQueryKey = prev[0].length;
      return [[nextQueryKey, ...prev[0]], { ...prev[1], [nextQueryKey]: {
        query: firstQuery.query, args: {
          startIndexKey: firstIndexKey,
          startInclusive: !firstIncluded,
          order: "desc",
        } },
      }];
    });
  }, []);
  const scrollToLetter = useCallback((letter: string) => {
    // NOTE this discards previous queries, which is not great, but it's fine for now.
    console.log("scrolling to letter", letter);
    setQueries([
      [0],
      { [0]: { query: api.contacts.contactsPage, args: { startIndexKey: [letter], startInclusive: true } }},
    ]);
  }, []);

  return {
    results,
    scrollDown,
    scrollUp,
    scrollToLetter,
  };
}

function ScrollingContacts({clickedLetter}: {clickedLetter?: string}) {
  const {
    results: contacts,
    scrollDown,
    scrollUp,
    scrollToLetter,
  } = usePaginatedContacts();

  /*
  const scrollRef = useRef<HTMLDivElement>(null);
  const emptyContacts = contacts.length === 0;
  useEffect(() => {
    // Set the initial scrollTop to 10 on component mount
    if (scrollRef.current) {
      console.log(`scrolling down a little (emptyContacts is ${emptyContacts}), scrollRef ${scrollRef.current.scrollHeight}`);
      scrollRef.current.scrollTop = 10;
      console.log(`scrolling down a little scrollTop is ${scrollRef.current.scrollTop}`);
    }
  }, [scrollRef, emptyContacts]);
  */

  const loader = useRef(null);
  // When the last contact is on screen, scrollDown
  const loaderIndex = contacts.length - 1;
  useEffect(() => {
    const handleObserver = (entries: any) => {
      const target = entries[0];
      console.log("handle observer triggered", target.isIntersecting);
      if (target.isIntersecting) {
        scrollDown();
      }
    };
    const observer = new IntersectionObserver(handleObserver);
    if (loader.current) {
      observer.observe(loader.current);
      console.log("intersection observer created at index", loaderIndex);
    }
    return () => observer.disconnect();
  }, [loader, loaderIndex, scrollDown]);
  
  // When the first contact is on screen, scrollUp
  /*
  const firstContactId = contacts[0]?._id ?? null;
  const upLoader = useRef(null);
  useEffect(() => {
    const handleObserver = (entries: any) => {
      const target = entries[0];
      console.log("handle scrollUp observer triggered", target.isIntersecting);
      if (target.isIntersecting) {
        scrollUp();
      }
    };
    const observer = new IntersectionObserver(handleObserver);
    if (upLoader.current) {
      observer.observe(upLoader.current);
      console.log("intersection observer for scrolling up created at index 0");
    }
    return () => observer.disconnect();
  }, [upLoader, scrollUp, firstContactId]);
  */

  const [prevActiveLetter, setPrevActiveLetter] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (clickedLetter && prevActiveLetter !== clickedLetter) {
      scrollToLetter(clickedLetter);
      setPrevActiveLetter(clickedLetter);
    }
  }, [clickedLetter, scrollToLetter, prevActiveLetter]);
  return (
    <div
      className="max-h-[100vh] overflow-y-auto flex flex-col flex-grow p-1"
    >
      <div className="absolute top-0 right-20">
        <Button onClick={scrollUp}>Scroll up</Button>
      </div>
      {contacts.map((contact, i) => {
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

function Alphabet({onClick}: 
  {onClick: (letter: string) => void}
) {
  // The alphabet should be a column of letters, each letter should be a button that, when clicked, scrolls the list of contacts to the first contact whose surname starts with that letter.
  // Instead of normal button styling, the buttons should have blue text and no background.
  // They should also be small and vertically condensed.
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
        <button
          key={letter}
          className="text-blue-500 bg-transparent text-sm"
          onClick={() => {
            onClick(letter);
          }}
        >{letter}</button>
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
