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
