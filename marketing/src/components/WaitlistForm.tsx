import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useJoinWaitlist } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  firstName: z.string().min(2, { message: "First name is required." }),
  lastName: z.string().min(2, { message: "Last name is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  childrenCount: z.coerce.number().min(0).max(20).optional().nullable(),
});

export function WaitlistForm() {
  const { toast } = useToast();
  const joinWaitlist = useJoinWaitlist();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      childrenCount: undefined,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    joinWaitlist.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "You're on the list!",
            description: "We'll notify you as soon as Trump Account Gift Cards are available.",
          });
          form.reset();
        },
        onError: (error) => {
          toast({
            title: "Error joining waitlist",
            description: error.error || "An unexpected error occurred. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="bg-primary border border-accent/20 p-8 md:p-10 w-full max-w-xl mx-auto shadow-2xl" id="waitlist">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">First Name</FormLabel>
                  <FormControl>
                    <Input className="bg-white text-primary border-none rounded-none focus-visible:ring-accent" placeholder="Jane" {...field} />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Last Name</FormLabel>
                  <FormControl>
                    <Input className="bg-white text-primary border-none rounded-none focus-visible:ring-accent" placeholder="Smith" {...field} />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Email Address</FormLabel>
                <FormControl>
                  <Input className="bg-white text-primary border-none rounded-none focus-visible:ring-accent" type="email" placeholder="jane@example.com" {...field} />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="childrenCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/80">Number of children/grandchildren (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    className="bg-white text-primary border-none rounded-none focus-visible:ring-accent"
                    type="number" 
                    placeholder="2" 
                    {...field} 
                    value={field.value || ''} 
                  />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-14 text-lg font-bold rounded-none mt-4 font-serif uppercase tracking-widest"
            disabled={joinWaitlist.isPending}
          >
            {joinWaitlist.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Joining...
              </>
            ) : (
              "Join the Waitlist"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}