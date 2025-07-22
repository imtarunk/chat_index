import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "../lib/supabase";
import { MessageDrawer } from "@/components/MessageDrawer"; // <- New component

interface SearchResult {
  id: number;
  message: string;
  similarity: number;
}

export function HybridSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: Track drawer open state and selected message
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null
  );

  const handleCardClick = (result: SearchResult) => {
    setSelectedResult(result);
    setDrawerOpen(true);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setResults([]);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "hybrid-search",
        { body: { query } }
      );
      if (invokeError) throw new Error(invokeError.message);
      if (!Array.isArray(data)) throw new Error("Unexpected result format.");
      setResults(data);
    } catch (err: any) {
      setError(err?.message ?? "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <section className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat History Search</CardTitle>
          <CardDescription>
            Enter a query to search through chat sessions with hybrid (AI &amp;
            keyword) search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            role="search"
            aria-label="Chat search"
          >
            <Input
              type="text"
              autoFocus
              placeholder="e.g., teaching profession challenges"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              disabled={isLoading}
              aria-label="Search chat history"
            />
            <Button type="submit" disabled={isLoading || !query.trim()}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4" aria-live="polite">
        {isLoading && (
          <p className="text-center text-gray-500">Loading search results...</p>
        )}
        {!isLoading && !error && results.length === 0 && (
          <p className="text-center text-gray-400">
            No results to display. Try a new search.
          </p>
        )}
        {!isLoading && !error && results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                Search Results
              </h2>
              <span className="text-xs rounded-full bg-sky-50 text-sky-600 px-3 py-1">
                {results.length} found
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map(({ id, message, similarity }) => {
                const isLong = message.length > 220;
                const preview = isLong
                  ? message.slice(0, 220) + "..."
                  : message;
                return (
                  <Card
                    key={id}
                    tabIndex={0}
                    onClick={() => handleCardClick({ id, message, similarity })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleCardClick({ id, message, similarity });
                    }}
                    className="overflow-hidden shadow-lg bg-white/70 border border-slate-100 hover:shadow-xl transition-shadow duration-300 cursor-pointer focus:ring-2 focus:ring-sky-200"
                    title="Click to view full message"
                  >
                    <CardHeader className="flex flex-row items-center justify-between px-6 py-4 bg-gradient-to-r from-sky-50 to-white">
                      <span
                        className="text-slate-700 font-medium text-base truncate"
                        title={message}
                      >
                        Message {id}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 min-w-[60px] text-center">
                        {(similarity * 100).toFixed(2)}%
                      </span>
                    </CardHeader>
                    <CardContent className="px-6 pb-5 pt-3 text-slate-700 text-[15px] min-h-[60px]">
                      <span>{preview}</span>
                      {isLong && (
                        <span className="ml-2 text-xs text-sky-600 underline">
                          Read more
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Drawer for full message */}
      <MessageDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        message={selectedResult?.message || ""}
        title={selectedResult ? `Message ${selectedResult.id}` : "Full Message"}
      />
    </section>
  );
}
