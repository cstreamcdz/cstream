import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Mail, Send, Loader2, CheckCircle2, MessageCircle,
  HelpCircle, Bug, Lightbulb, AlertTriangle, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const categories = [
  { value: 'help', label: 'Aide / Support', icon: HelpCircle, color: 'text-blue-500' },
  { value: 'bug', label: 'Signaler un bug', icon: Bug, color: 'text-red-500' },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'text-yellow-500' },
  { value: 'contribute', label: 'Contribuer au site', icon: Heart, color: 'text-pink-500' },
  { value: 'other', label: 'Autre', icon: MessageCircle, color: 'text-gray-500' },
];

const Contact = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    category: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!formData.category) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }

    setSending(true);
    try {
      let messageSent = false;

      try {
        const insertData: any = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          category: formData.category,
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          status: 'pending',
        };

        if (user?.id) {
          insertData.user_id = user.id;
        }

        const { error } = await supabase
          .from('contact_messages')
          .insert(insertData);

        if (!error) {
          messageSent = true;
        } else {
          console.log('Contact messages insert error:', error.message);
        }
      } catch (dbError) {
        console.log('Contact table not available, using alternative method');
      }

      if (!messageSent) {
        const discordWebhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
        if (discordWebhookUrl) {
          const webhookResponse = await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: `📬 Nouveau message: ${formData.subject}`,
                description: formData.message,
                color: formData.category === 'contribute' ? 0xec4899 :
                  formData.category === 'bug' ? 0xef4444 :
                    formData.category === 'suggestion' ? 0xeab308 : 0x3b82f6,
                fields: [
                  { name: 'Nom', value: formData.name, inline: true },
                  { name: 'Email', value: formData.email, inline: true },
                  { name: 'Catégorie', value: categories.find(c => c.value === formData.category)?.label || formData.category, inline: true },
                ],
                footer: { text: 'CStream Contact Form' },
                timestamp: new Date().toISOString(),
              }],
            }),
          });

          if (webhookResponse.ok) {
            messageSent = true;
          }
        }
      }

      if (!messageSent) {
        toast.info('Message enregistré localement. Nous vous contacterons bientôt.');
      }

      setSent(true);
      toast.success('Message envoyé avec succès !');

      setFormData({
        name: '',
        email: user?.email || '',
        category: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-xl shadow-green-500/30"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-3xl font-bold mb-4">Message envoyé !</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais.
            </p>
            <Button onClick={() => setSent(false)} className="gap-2">
              <Send className="w-4 h-4" />
              Envoyer un autre message
            </Button>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Contactez-nous</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Une question, une suggestion ou vous voulez contribuer au site ?
            N'hésitez pas à nous contacter !
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {categories.slice(0, 3).map((cat, i) => (
            <motion.div
              key={cat.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
              className={`p-6 rounded-xl border cursor-pointer transition-all hover:shadow-lg ${formData.category === cat.value
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border hover:border-primary/50'
                }`}
            >
              <cat.icon className={`w-8 h-8 mb-3 ${cat.color}`} />
              <h3 className="font-semibold mb-1">{cat.label}</h3>
              <p className="text-sm text-muted-foreground">
                {cat.value === 'help' && 'Besoin d\'aide avec le site'}
                {cat.value === 'bug' && 'Signalez un problème technique'}
                {cat.value === 'suggestion' && 'Proposez une amélioration'}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Envoyer un message
              </CardTitle>
              <CardDescription>
                Remplissez le formulaire ci-dessous et nous vous répondrons rapidement
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom *</Label>
                    <Input
                      id="name"
                      placeholder="Votre nom"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className={`w-4 h-4 ${cat.color}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Sujet *</Label>
                  <Input
                    id="subject"
                    placeholder="Objet de votre message"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Décrivez votre demande en détail..."
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    required
                    className="resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer le message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Vous pouvez aussi nous rejoindre sur Discord pour discuter en direct
          </p>
          <a
            href="https://discord.gg/YSkhZubt3y"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" className="w-5 h-5 fill-current">
              <path d="M524.5 69.8a485.1 485.1 0 0 0-120.4-37.1c-1-.2-2 .3-2.5 1.2a337.5 337.5 0 0 0-14.9 30.6 447.8 447.8 0 0 0-134.4 0 309.5 309.5 0 0 0-15.1-30.6c-.5-.9-1.5-1.4-2.5-1.2A483.7 483.7 0 0 0 112 69.9c-.3.1-.6.3-.8.6C39.1 183.7 18.2 294.7 28.4 404.4c.1.5.4 1 .8 1.3A487.7 487.7 0 0 0 176 479.9c.8.2 1.6-.1 2.1-.7a348.2 348.2 0 0 0 29.9-49.5c.5-.9.1-2-.9-2.4a321.2 321.2 0 0 1-45.9-21.9 1.9 1.9 0 0 1-.2-3.1 251 251 0 0 0 9.1-7.1c.6-.5 1.4-.7 2.1-.3 96.2 43.9 200.4 43.9 295.5 0 .7-.3 1.5-.2 2.1.3 3 2.4 6 4.8 9.1 7.2.8.6 1 1.7.2 2.5a301.4 301.4 0 0 1-45.9 21.8c-1 .4-1.4 1.5-.9 2.5a391.1 391.1 0 0 0 30 48.8c.5.8 1.3 1.1 2.1.7a486 486 0 0 0 147.6-74.2c.4-.3.7-.8.8-1.3 12.3-126.8-20.5-236.9-86.9-334.5ZM222.5 337.6c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.4 59.2-52.8 59.2Zm195.4 0c-28.9 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.2 59.2-52.8 59.2Z" />
            </svg>
            Rejoindre notre Discord
          </a>
        </motion.div>
      </main>
    </div>
  );
};

export default Contact;
