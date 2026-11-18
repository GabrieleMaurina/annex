export interface Friend {
  id: string;
  username: string;
  elo: number;
  country: string;
}

export interface FriendsOverview {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  blocked: Friend[];
}

export interface ConversationMessage {
  fromMe: boolean;
  text: string;
  createdAt: number;
}

export interface Conversation {
  userId: string;
  username: string;
  elo: number;
  country: string;
  messages: ConversationMessage[];
}

export interface BlockedPlayer {
  userId: string;
  username: string;
  elo: number;
  country: string;
}

export interface MessagesOverview {
  conversations: Conversation[];
  blocked: BlockedPlayer[];
}

export type InviteKind = 'challenge' | 'invite';

export interface IncomingInvite {
  id: string;
  kind: InviteKind;
  fromUserId: string;
  fromName: string;
  gameName: string;
  newGame: boolean;
  accepted: boolean;
  ready: boolean;
}

export interface OutgoingInvite {
  id: string;
  kind: InviteKind;
  toUserId: string;
  toName: string;
  gameName: string;
  newGame: boolean;
  accepted: boolean;
  ready: boolean;
}

export interface InviteSetup {
  casual: boolean;
}

export interface InvitesOverview {
  incoming: IncomingInvite[];
  outgoing: OutgoingInvite[];
}
