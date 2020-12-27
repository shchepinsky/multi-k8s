# this is deploy script because Travis has no
# Kubernetes provider built-in

docker build -t shchepinsky/multi-client:latest -t shchepinsky/multi-client:"$SHA" -f ./client/Dockerfile ./client
docker build -t shchepinsky/multi-server:latest -t shchepinsky/multi-server:"$SHA" -f ./server/Dockerfile ./server
docker build -t shchepinsky/multi-worker:latest -t shchepinsky/multi-worker:"$SHA" -f ./worker/Dockerfile ./worker

# push built images to docker hub
docker push shchepinsky/multi-client:latest
docker push shchepinsky/multi-client:"$SHA"

docker push shchepinsky/multi-server:latest
docker push shchepinsky/multi-server:"$SHA"

docker push shchepinsky/multi-worker:latest
docker push shchepinsky/multi-worker:"$SHA"

# apply Kubernetes configuration from folder
kubectl apply -f k8s

# update deployment by supplying container with latest version of docker image
kubectl set image deployments/server-deployment server=shchepinsky/multi-server:"$SHA"
kubectl set image deployments/client-deployment client=shchepinsky/multi-client:"$SHA"
kubectl set image deployments/worker-deployment worker=shchepinsky/multi-worker:"$SHA"