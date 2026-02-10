import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, Clock, Check, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ContactMessage {
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    category: string;
    subject: string;
    message: string;
    status: 'pending' | 'read' | 'replied';
    created_at: string;
}

export function ContactMessagesTab() {
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('contact_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Erreur lors du chargement des messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('contact_messages')
                .update({ status: 'read' })
                .eq('id', id);

            if (error) throw error;
            setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'read' } : m));
            toast.success('Message marqué comme lu');
        } catch (error) {
            toast.error('Erreur lors de la mise à jour');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) return;
        try {
            const { error } = await supabase
                .from('contact_messages')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setMessages(prev => prev.filter(m => m.id !== id));
            toast.success('Message supprimé');
        } catch (error) {
            toast.error('Erreur lors de la suppression');
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-xl border border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-primary" />
                        Messages de Contact
                        <Badge variant="secondary" className="ml-2">
                            {messages.filter(m => m.status === 'pending').length} nouveaux
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-white/10 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Utilisateur</TableHead>
                                    <TableHead>Sujet</TableHead>
                                    <TableHead>Catégorie</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {messages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Aucun message reçu
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    messages.map((message) => (
                                        <TableRow key={message.id} className="hover:bg-white/5 transition-colors">
                                            <TableCell className="font-mono text-xs">
                                                {new Date(message.created_at).toLocaleDateString()}
                                                <br />
                                                <span className="text-muted-foreground">
                                                    {new Date(message.created_at).toLocaleTimeString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{message.name}</span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Mail className="w-3 h-3" /> {message.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[300px]">
                                                    <p className="font-medium truncate" title={message.subject}>{message.subject}</p>
                                                    <p className="text-xs text-muted-foreground truncate" title={message.message}>
                                                        {message.message}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{message.category}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={
                                                        message.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' :
                                                            message.status === 'read' ? 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30' :
                                                                'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                                    }
                                                >
                                                    {message.status === 'pending' ? 'En attente' :
                                                        message.status === 'read' ? 'Lu' : 'Répondu'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {message.status === 'pending' && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleMarkAsRead(message.id)}
                                                            title="Marquer comme lu"
                                                        >
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => window.location.href = `mailto:${message.email}?subject=Re: ${message.subject}`}
                                                        title="Répondre par email"
                                                    >
                                                        <Mail className="w-4 h-4 text-blue-500" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(message.id)}
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
