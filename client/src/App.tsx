import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ChatProvider, useChat } from "@/lib/chat-context";
import RankingsPage from "@/pages/RankingsPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import FloatingChatButton from "@/components/FloatingChatButton";
import ChatDialog from "@/components/ChatDialog";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const { isChatOpen, openChat, closeChat } = useChat();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const handleChatOpenChange = (open: boolean) => {
    if (!open) {
      closeChat();
    } else {
      openChat();
    }
  };

  return (
    <>
      <Switch>
        <Route path="/auth">
          {user ? <Redirect to="/" /> : <AuthPage />}
        </Route>
        <Route path="/">
          <ProtectedRoute component={RankingsPage} />
        </Route>
        <Route component={NotFound} />
      </Switch>
      
      {user && (
        <>
          <FloatingChatButton onClick={openChat} />
          <ChatDialog open={isChatOpen} onOpenChange={handleChatOpenChange} />
        </>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChatProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ChatProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;