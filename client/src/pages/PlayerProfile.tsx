import { Container } from 'react-bootstrap';
import { useParams } from 'react-router-dom';

function PlayerProfile() {
  const { username } = useParams();
  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center">{username}</h1>
    </Container>
  );
}

export default PlayerProfile;
